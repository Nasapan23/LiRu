//! HC-05 Bluetooth module driver using USART6
//!
//! Pins:
//! - PC6: TX (to HC-05 RX)
//! - PC7: RX (from HC-05 TX)  
//! - PB6: STATE (high when connected)

use embassy_stm32::usart::{self, Uart};
use embassy_stm32::gpio::Input;
use embassy_stm32::mode::Async;
use defmt::info;

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

    /// Read data from Bluetooth into buffer
    /// Returns number of bytes read
    pub async fn read(&mut self, buf: &mut [u8]) -> Result<usize, usart::Error> {
        self.uart.read(buf).await?;
        Ok(buf.len())
    }

    /// Write data to Bluetooth
    pub async fn write(&mut self, data: &[u8]) -> Result<(), usart::Error> {
        self.uart.write(data).await
    }

    /// Read a single byte
    pub async fn read_byte(&mut self) -> Result<u8, usart::Error> {
        let mut buf = [0u8; 1];
        self.uart.read(&mut buf).await?;
        Ok(buf[0])
    }

    /// Write a single byte
    pub async fn write_byte(&mut self, byte: u8) -> Result<(), usart::Error> {
        self.uart.write(&[byte]).await
    }
}

/// Echo task - reads from Bluetooth and echoes back
pub async fn echo_task(bt: &mut Bluetooth<'_>) {
    let mut was_connected = false;
    
    loop {
        // Check connection state
        let connected = bt.is_connected();
        if connected != was_connected {
            if connected {
                info!("Bluetooth connected!");
            } else {
                info!("Bluetooth disconnected");
            }
            was_connected = connected;
        }

        // Try to read and echo
        if connected {
            match bt.read_byte().await {
                Ok(byte) => {
                    info!("Received: {}", byte as char);
                    let _ = bt.write_byte(byte).await;
                }
                Err(_) => {
                    // Read error, continue
                }
            }
        }
    }
}
