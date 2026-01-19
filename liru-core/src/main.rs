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
    
    // Line follower: remember last direction (0=forward, -1=left, 1=right)
    let mut last_direction: i8 = 0;
    
    // Analog telemetry tracking
    let mut last_weighted_pos: i32 = 0;
    let mut last_intensity: u32 = 0;
    let mut last_steering: i32 = 0;
    let mut last_left_speed: u8 = 0;
    let mut last_right_speed: u8 = 0;
    
    // Debug: send info every N iterations to avoid spam
    let mut loop_counter: u32 = 0;
    let mut last_position: u8 = 0;

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
                // Debug: Print raw sensor ADC values every 50 loops (~500ms)
                if loop_counter % 50 == 0 {
                    let raw = sensors.read_all();
                    info!("ADC: {} {} {} {} {} {} {} {}", 
                        raw[0], raw[1], raw[2], raw[3], 
                        raw[4], raw[5], raw[6], raw[7]);
                }
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
                // Read weighted position (-3500 to 3500) and intensity
                let (raw_position, intensity) = sensors.read_line_position();
                
                // Use raw position directly - no offset needed
                // Positive = line on right side, Negative = line on left side
                let position = raw_position;
                
                // Update telemetry (show corrected position)
                last_weighted_pos = position;
                last_intensity = intensity;
                
                // For debug output
                let raw_binary = sensors.read_binary(); 
                last_position = raw_binary;

                if intensity == 0 {
                    // Lost line - search in last known direction (moderate speed)
                    match last_direction {
                        d if d < 0 => motors.turn_left(55),
                        d if d > 0 => motors.turn_right(55),
                        _ => motors.forward(50),
                    }
                } else {
                    // Line found - Deliberate Proportional Control
                    // Physical orientation: Index 0 = Left side of robot
                    // Negative position = line on LEFT -> need to turn LEFT
                    
                    // Absolute position determines behavior
                    let abs_pos = if position < 0 { -position } else { position };
                    
                    // Constants - gentler steering response
                    let kp_divisor: i32 = 100;
                    
                    // Calculate steering adjustment
                    let steering = position / kp_divisor;
                    
                    // Speed depends on how centered the line is
                    // More centered = faster, off-center = slower but still moving
                    // Minimum 50 to overcome motor friction!
                    let base_speed: i32 = if abs_pos < 500 {
                        // Line is well centered - go at good speed
                        65
                    } else if abs_pos < 1500 {
                        // Line is slightly off - moderate speed
                        55
                    } else {
                        // Line is far off - slower but still moving
                        50
                    };
                    
                    // Calculate motor speeds (cap at 75 for safety)
                    let left_speed = (base_speed + steering).clamp(0, 75) as i8;
                    let right_speed = (base_speed - steering).clamp(0, 75) as i8;
                    
                    motors.set_both(left_speed, right_speed);
                    
                    // Update telemetry
                    last_steering = steering;
                    last_left_speed = left_speed as u8;
                    last_right_speed = right_speed as u8;
                    
                    // Update last direction for when we lose line
                    if steering > 5 {
                        last_direction = 1;  // Was turning right
                    } else if steering < -5 {
                        last_direction = -1; // Was turning left
                    } else {
                        last_direction = 0;  // Going straight
                    }
                }
            }
        }
        
        // Increment loop counter for periodic debug
        loop_counter += 1;
        
        // Send debug info every 20 loops (~200ms) when in LineFollowerRunning
        if let RobotMode::LineFollowerRunning = mode {
            if loop_counter % 20 == 0 {
                 let _ = bt.send_analog_debug(
                     last_weighted_pos as i16,
                     last_intensity as u16,
                     last_steering as i8,
                     last_left_speed,
                     last_right_speed
                 ).await;
            }
        }
        
        // Small delay to prevent tight loop hogging if nothing to do? 
        // W/ Embassy, usually we await something. But here we poll.
        Timer::after_millis(10).await;
    }
}
