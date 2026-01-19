#![no_std]
#![no_main]

mod motors;
mod sensors;
mod bluetooth;

use defmt::info;
use embassy_executor::Spawner;
use embassy_stm32::adc::Adc;
use embassy_stm32::gpio::{Input, Level, Output, Pull, Speed};
use embassy_stm32::bind_interrupts;
use embassy_stm32::usart::{Config as UartConfig, Uart};

use embassy_stm32::Config;
use embassy_time::{Timer, Instant};
use {defmt_rtt as _, panic_probe as _};

use motors::MotorController;
use sensors::{LineSensors, CalibratedSensors};
use bluetooth::{Bluetooth, Command};

bind_interrupts!(struct Irqs {
    USART6 => embassy_stm32::usart::InterruptHandler<embassy_stm32::peripherals::USART6>;
});

defmt::timestamp!("{=u64}", { embassy_time::Instant::now().as_millis() });

#[embassy_executor::task]
async fn blink_task(mut led: Output<'static>) {
    loop {
        led.toggle();
        Timer::after_millis(500).await;
    }
}

#[derive(PartialEq)]
enum RobotMode {
    Car,
    LineFollowerIdle,
    LineFollowerCalibrating(Instant),
    LineFollowerRunning,
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_stm32::init(Config::default());

    info!("=== LiRu Robot Controller ===");

    // LED blink task
    let led = Output::new(p.PA5, Level::Low, Speed::Low);
    spawner.spawn(blink_task(led)).unwrap();

    // Initialize motor controller
    // TIM1: PA8=CH1, PA9=CH2, PA10=CH3, PA11=CH4
    let mut motors = MotorController::new(p.TIM1, p.PA8, p.PA9, p.PA10, p.PA11);
    info!("Motors initialized");

    // Initialize sensors via ADC
    let adc = Adc::new(p.ADC1);
    let mut sensors = CalibratedSensors::new(LineSensors::new(
        adc,
        p.PA0, p.PA1, p.PA4, p.PB0, p.PC1, p.PC0, p.PC3, p.PC2
    ));
    info!("Sensors initialized");

    // Initialize Bluetooth (USART6)
    // PC6=TX, PC7=RX, PB6=STATE
    let mut uart_config = UartConfig::default();
    uart_config.baudrate = 9600; // HC-05 default baud rate
    
    let uart = Uart::new(
        p.USART6,
        p.PC7,  // RX
        p.PC6,  // TX
        Irqs,
        p.DMA2_CH6, // TX DMA
        p.DMA2_CH1, // RX DMA
        uart_config,
    ).unwrap();
    
    let state_pin = Input::new(p.PB6, Pull::Down);
    let mut bt = Bluetooth::new(uart, state_pin);
    info!("Bluetooth initialized (9600 baud)");

    info!("Ready! Waiting for commands...");
    info!("Commands: W=forward, S=back, A=left, D=right, Q=stop");

    // Motor speed for keyboard control
    let speed: u8 = 70;
    
    // Default mode
    let mut mode = RobotMode::Car;

    loop {
        // Check Bluetooth connection
        if bt.is_connected() {
            // Use shorter timeout during calibration so we can update sensors
            // Use longer timeout otherwise to ensure responsiveness
            let timeout_ms = match mode {
                RobotMode::LineFollowerCalibrating(_) | RobotMode::LineFollowerRunning => 20,
                _ => 100,
            };
            
            // Try to read command with timeout (non-blocking)
            if let Some(cmd) = bt.try_read_command(timeout_ms).await {
                match cmd {
                    Command::Motor { left, right } => {
                        motors.set_both(left, right);
                    }
                    Command::Stop => {
                        motors.stop_all();
                        // If in Line Follower mode, reset to Idle so user can recalibrate
                        match mode {
                            RobotMode::LineFollowerCalibrating(_) | RobotMode::LineFollowerRunning => {
                                info!("Stop received, resetting to Line Follower Idle");
                                mode = RobotMode::LineFollowerIdle;
                            }
                            _ => {}
                        }
                    }
                    Command::SetMode(m) => {
                        if m == 1 {
                            mode = RobotMode::LineFollowerIdle;
                            info!("Switched to Line Follower Mode (Idle)");
                            motors.stop_all();
                        } else {
                            mode = RobotMode::Car;
                            info!("Switched to Car Mode");
                            motors.stop_all();
                        }
                    }
                    Command::Start => {
                         if let RobotMode::LineFollowerIdle = mode {
                            info!("Starting Calibration...");
                            sensors.reset_calibration();
                            let _ = bt.send_calibration_start().await;
                            mode = RobotMode::LineFollowerCalibrating(Instant::now());
                        }
                    }
                    Command::GetSensors => {
                        // Only allow reading sensors if requested, regardless of mode (debug)
                        let binary = sensors.read_binary();
                        // Keep infrequent logs or remove if strictly needed, but sensor readout implies we want data
                        // info!("Sensors: {:08b}", binary); 
                        let _ = bt.send_sensors(binary).await;
                    }
                    Command::GetRawSensors => {
                         // Only allow reading sensors if requested
                        let raw = sensors.read_all();
                        // info!("Raw Sens: {:?}", raw);
                        let _ = bt.send_raw_sensors(raw).await;
                    }
                    Command::Ping => {
                        let _ = bt.send_pong().await;
                    }
                    Command::Unknown(byte) => {
                        // Handle WASD keyboard input ONLY in Car mode
                        if let RobotMode::Car = mode {
                            match byte {
                                b'W' | b'w' => {
                                    motors.forward(speed);
                                }
                                b'S' | b's' => {
                                    motors.backward(speed);
                                }
                                b'A' | b'a' => {
                                    motors.turn_left(speed);
                                }
                                b'D' | b'd' => {
                                    motors.turn_right(speed);
                                }
                                b'Q' | b'q' | b' ' => {
                                    motors.stop_all();
                                }
                                b'R' | b'r' => {
                                    // Read sensors - this is manual debug, maybe keep log or remove?
                                    // Removing log for consistency with speed
                                    let readings = sensors.read_all();
                                    let _ = bt.send_raw_sensors(readings).await;
                                }
                                _ => {
                                    // info!("Unknown: {}", byte);
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // Not connected, just blink and wait by skipping logic
        }

        // Logic loop based on mode (Non-blocking)
        match mode {
            RobotMode::Car => {
                // Controlled via Bluetooth/UART, nothing to do here
            }
            RobotMode::LineFollowerIdle => {
                // Waiting for Start command
            }
            RobotMode::LineFollowerCalibrating(start_time) => {
                // Calibrate for 10 seconds
                if start_time.elapsed().as_secs() < 10 {
                    sensors.update_calibration();
                } else {
                    info!("Calibration Complete! Running...");
                    sensors.finalize_calibration();
                    let _ = bt.send_calibration_end().await;
                    mode = RobotMode::LineFollowerRunning;
                }
            }
            RobotMode::LineFollowerRunning => {
                let position = sensors.read_binary();
                // Sensors: bit 0 = sensor 1 (left edge), bit 7 = sensor 8 (right edge)
                
                // Count how many sensors see the line
                let sensor_count = position.count_ones();
                
                if sensor_count == 0 {
                    // No sensors - lost line, keep going forward slowly
                    motors.forward(50);
                } else if sensor_count >= 6 {
                    // Too many sensors on - probably confused or bad calibration
                    // Just go forward at medium speed
                    motors.forward(60);
                } else if (position & 0b00011000) != 0 && sensor_count <= 4 {
                    // Center sensors (bits 3,4) see line and not too many sensors
                    motors.forward(80);
                } else if (position & 0b11100000) != 0 {
                    // Left side sensors (bits 5,6,7) see line -> Turn Left
                    motors.turn_left(70);
                } else if (position & 0b00000111) != 0 {
                    // Right side sensors (bits 0,1,2) see line -> Turn Right
                    motors.turn_right(70);
                } else {
                    // Default - go forward
                    motors.forward(60);
                }
            }
        }
        
        // Small delay to prevent tight loop hogging if nothing to do? 
        // W/ Embassy, usually we await something. But here we poll.
        Timer::after_millis(10).await;
    }
}
