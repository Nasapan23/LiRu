//! HY-S301 8-Channel Line Tracking Sensor module for LiRu robot.
//!
//! Uses ADC to read analog values from each sensor.
//! Lower values = more light reflected (white surface)
//! Higher values = less light reflected (black surface)
//!
//! Pin Mapping (ADC1 channels):
//! - Line 1: PA0 (ADC1_IN0)
//! - Line 2: PA1 (ADC1_IN1)
//! - Line 3: PA4 (ADC1_IN4)
//! - Line 4: PB0 (ADC1_IN8)
//! - Line 5: PC1 (ADC1_IN11)
//! - Line 6: PC0 (ADC1_IN10)
//! - Line 7: PC3 (ADC1_IN13)
//! - Line 8: PC2 (ADC1_IN12)

use embassy_stm32::adc::Adc;
use embassy_stm32::peripherals::{ADC1, PA0, PA1, PA4, PB0, PC0, PC1, PC2, PC3};

/// Number of sensors in the array.
pub const SENSOR_COUNT: usize = 8;

/// Raw ADC readings (0-4095).
pub type SensorReadings = [u16; SENSOR_COUNT];

/// HY-S301 Line sensor array controller using ADC.
pub struct LineSensors<'d> {
    adc: Adc<'d, ADC1>,
    pin_l1: PA0,
    pin_l2: PA1,
    pin_l3: PA4,
    pin_l4: PB0,
    pin_l5: PC1,
    pin_l6: PC0,
    pin_l7: PC3,
    pin_l8: PC2,
}

impl<'d> LineSensors<'d> {
    /// Create a new line sensor array with ADC.
    pub fn new(
        adc: Adc<'d, ADC1>,
        pa0: PA0,
        pa1: PA1,
        pa4: PA4,
        pb0: PB0,
        pc1: PC1,
        pc0: PC0,
        pc3: PC3,
        pc2: PC2,
    ) -> Self {
        Self {
            adc,
            pin_l1: pa0,
            pin_l2: pa1,
            pin_l3: pa4,
            pin_l4: pb0,
            pin_l5: pc1,
            pin_l6: pc0,
            pin_l7: pc3,
            pin_l8: pc2,
        }
    }

    /// Read all 8 sensors and return raw ADC values (0-4095).
    pub fn read_all(&mut self) -> SensorReadings {
        [
            self.adc.blocking_read(&mut self.pin_l1),
            self.adc.blocking_read(&mut self.pin_l2),
            self.adc.blocking_read(&mut self.pin_l3),
            self.adc.blocking_read(&mut self.pin_l4),
            self.adc.blocking_read(&mut self.pin_l5),
            self.adc.blocking_read(&mut self.pin_l6),
            self.adc.blocking_read(&mut self.pin_l7),
            self.adc.blocking_read(&mut self.pin_l8),
        ]
    }

    /// Read sensors and convert to binary using a threshold.
    /// Returns u8 where bit 0 = sensor 1, bit 7 = sensor 8.
    /// 1 = above threshold (line detected), 0 = below threshold.
    pub fn read_binary(&mut self, threshold: u16) -> u8 {
        let readings = self.read_all();
        let mut result: u8 = 0;

        for (i, &value) in readings.iter().enumerate() {
            if value > threshold {
                result |= 1 << i;
            }
        }

        result
    }

    /// Get the average reading across all sensors.
    pub fn read_average(&mut self) -> u16 {
        let readings = self.read_all();
        let sum: u32 = readings.iter().map(|&v| v as u32).sum();
        (sum / SENSOR_COUNT as u32) as u16
    }
}
