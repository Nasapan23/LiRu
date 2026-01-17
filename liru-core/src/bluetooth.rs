//! HC-05 Bluetooth module driver using USART6
//!
//! Pins:
//! - PC6: TX (to HC-05 RX)
//! - PC7: RX (from HC-05 TX)  
//! - PB6: STATE (high when connected)
//!
//! Protocol:
//! - Commands from GUI: [CMD_BYTE, DATA...]
//! - Data to GUI: [MSG_TYPE, DATA...]

use embassy_stm32::usart::{self, Uart};
use embassy_stm32::gpio::Input;
use embassy_stm32::mode::Async;

/// Command bytes from GUI
pub mod cmd {
    /// Set motor speeds: [CMD_MOTOR, left_speed_i8, right_speed_i8]
    pub const MOTOR: u8 = 0x01;
    /// Stop all motors
    pub const STOP: u8 = 0x02;
    /// Request sensor data
    pub const GET_SENSORS: u8 = 0x03;
    /// Ping (for connection check)
    pub const PING: u8 = 0x04;
    /// Request raw sensor data (16-bit)
    pub const GET_RAW_SENSORS: u8 = 0x05;
}

/// Message types to GUI
pub mod msg {
    /// Sensor data: [MSG_SENSORS, sensor_byte]
    pub const SENSORS: u8 = 0x10;
    /// Pong response
    pub const PONG: u8 = 0x11;
    /// Connection established
    pub const CONNECTED: u8 = 0x12;
    /// Raw sensor data: [MSG_RAW_SENSORS, 16 bytes of data]
    pub const RAW_SENSORS: u8 = 0x13;
    /// Error message
    pub const ERROR: u8 = 0xFF;
}

/// Parsed command from GUI
#[derive(Debug, Clone, Copy)]
pub enum Command {
    /// Set motor speeds (left, right) from -100 to 100
    Motor { left: i8, right: i8 },
    /// Stop all motors
    Stop,
    /// Request sensor readings
    GetSensors,
    /// Request raw sensor readings
    GetRawSensors,
    /// Ping request
    Ping,
    /// Unknown command
    Unknown(u8),
}

/// HC-05 Bluetooth driver
pub struct Bluetooth<'d> {
    uart: Uart<'d, Async>,
    state_pin: Input<'d>,
}

impl<'d> Bluetooth<'d> {
    /// Create a new Bluetooth driver instance
    pub fn new(uart: Uart<'d, Async>, state_pin: Input<'d>) -> Self {
        Self { uart, state_pin }
    }

    /// Check if a device is connected (STATE pin high)
    pub fn is_connected(&self) -> bool {
        self.state_pin.is_high()
    }

    /// Read a single byte (blocking until received)
    pub async fn read_byte(&mut self) -> Result<u8, usart::Error> {
        let mut buf = [0u8; 1];
        self.uart.read(&mut buf).await?;
        Ok(buf[0])
    }

    /// Write bytes to Bluetooth
    pub async fn write(&mut self, data: &[u8]) -> Result<(), usart::Error> {
        self.uart.write(data).await
    }

    /// Send sensor data to GUI
    pub async fn send_sensors(&mut self, sensor_byte: u8) -> Result<(), usart::Error> {
        self.write(&[msg::SENSORS, sensor_byte]).await
    }

    /// Send raw sensor data (8 channels, u16)
    pub async fn send_raw_sensors(&mut self, readings: [u16; 8]) -> Result<(), usart::Error> {
        let mut buf = [0u8; 17];
        buf[0] = msg::RAW_SENSORS;
        for (i, &reading) in readings.iter().enumerate() {
            let bytes = reading.to_le_bytes();
            buf[1 + i * 2] = bytes[0];
            buf[1 + i * 2 + 1] = bytes[1];
        }
        self.write(&buf).await
    }

    /// Send pong response
    pub async fn send_pong(&mut self) -> Result<(), usart::Error> {
        self.write(&[msg::PONG]).await
    }

    /// Send connected notification
    pub async fn send_connected(&mut self) -> Result<(), usart::Error> {
        self.write(&[msg::CONNECTED]).await
    }

    /// Read and parse a command from GUI
    /// Returns None if no complete command available
    pub async fn read_command(&mut self) -> Result<Command, usart::Error> {
        let cmd_byte = self.read_byte().await?;

        match cmd_byte {
            cmd::MOTOR => {
                let left = self.read_byte().await? as i8;
                let right = self.read_byte().await? as i8;
                Ok(Command::Motor { left, right })
            }
            cmd::STOP => Ok(Command::Stop),
            cmd::GET_SENSORS => Ok(Command::GetSensors),
            cmd::GET_RAW_SENSORS => Ok(Command::GetRawSensors),
            cmd::PING => Ok(Command::Ping),
            other => Ok(Command::Unknown(other)),
        }
    }
}
