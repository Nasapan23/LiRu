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
use embassy_time::Timer;
use {defmt_rtt as _, panic_probe as _};

use motors::MotorController;
use sensors::LineSensors;
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
    LineFollower,
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
    let mut sensors = LineSensors::new(
        adc,
        p.PA0, p.PA1, p.PA4, p.PB0, p.PC1, p.PC0, p.PC3, p.PC2
    );
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
            // Try to read command
            match bt.read_command().await {
                Ok(cmd) => {
                    match cmd {
                        Command::Motor { left, right } => {
                            motors.set_both(left, right);
                        }
                        Command::Stop => {
                            motors.stop_all();
                        }
                        Command::SetMode(m) => {
                            if m == 1 {
                                mode = RobotMode::LineFollower;
                                info!("Switched to Line Follower Mode");
                            } else {
                                mode = RobotMode::Car;
                                info!("Switched to Car Mode");
                            }
                        }
                        Command::GetSensors => {
                            // Only allow reading sensors if requested, regardless of mode (debug)
                            let binary = sensors.read_binary(1500);
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
                            // Handle WASD keyboard input
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
                Err(_) => {
                    // Read error, continue
                }
            }
        } else {
            // Not connected, just blink and wait
            Timer::after_millis(100).await;
        }
    }
}
