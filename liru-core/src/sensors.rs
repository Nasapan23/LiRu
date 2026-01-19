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

/// Line sensor controller with calibration support
pub struct CalibratedSensors<'d> {
    sensors: LineSensors<'d>,
    min_readings: SensorReadings,
    max_readings: SensorReadings,
    thresholds: SensorReadings,
    calibrated: bool,
}

impl<'d> CalibratedSensors<'d> {
    pub fn new(sensors: LineSensors<'d>) -> Self {
        Self {
            sensors,
            min_readings: [4095; SENSOR_COUNT],
            max_readings: [0; SENSOR_COUNT],
            thresholds: [2000; SENSOR_COUNT], // Default safe value
            calibrated: false,
        }
    }

    pub fn read_all(&mut self) -> SensorReadings {
        self.sensors.read_all()
    }

    pub fn reset_calibration(&mut self) {
        self.min_readings = [4095; SENSOR_COUNT];
        self.max_readings = [0; SENSOR_COUNT];
        self.calibrated = false;
        defmt::info!("Calibration reset");
    }

    pub fn update_calibration(&mut self) {
        let readings = self.sensors.read_all();
        for (i, &val) in readings.iter().enumerate() {
            if val < self.min_readings[i] {
                self.min_readings[i] = val;
            }
            if val > self.max_readings[i] {
                self.max_readings[i] = val;
            }
        }
    }

    pub fn finalize_calibration(&mut self) {
        defmt::info!("Calibration min: {:?}", self.min_readings);
        defmt::info!("Calibration max: {:?}", self.max_readings);
        
        for i in 0..SENSOR_COUNT {
            // Threshold is midpoint between min and max
            // Add some hysteresis margin (40% from min towards max)
            let range = self.max_readings[i].saturating_sub(self.min_readings[i]);
            self.thresholds[i] = self.min_readings[i] + (range * 40 / 100);
        }
        
        defmt::info!("Calibration thresholds: {:?}", self.thresholds);
        self.calibrated = true;
    }

    /// Read binary using calibrated thresholds
    pub fn read_binary(&mut self) -> u8 {
        let readings = self.sensors.read_all();
        let mut result: u8 = 0;

        for (i, &value) in readings.iter().enumerate() {
             // For these sensors (black line on white background):
             // High value = Black (Line), Low value = White (Background)
             // So if value > threshold, it's a line.
            if value > self.thresholds[i] {
                result |= 1 << i;
            }
        }
        result
    }

    /// Calculate weighted line position using calibrated values.
    /// Returns (position, intensity)
    /// position: -3500 (Right/Index0) to 3500 (Left/Index7), 0 is Center.
    /// intensity: Sum of calibrated sensor values (0-8000), useful for line loss detection.
    pub fn read_line_position(&mut self) -> (i32, u32) {
        let readings = self.sensors.read_all();
        let mut weighted_sum: i32 = 0;
        let mut total_intensity: u32 = 0;

        for (i, &raw_val) in readings.iter().enumerate() {
            let min = self.min_readings[i];
            let max = self.max_readings[i];
            
            // Normalize raw_val to 0-1000
            let val = if raw_val <= min {
                0
            } else if raw_val >= max {
                1000
            } else {
                let range = max - min;
                if range == 0 { 0 } else { ((raw_val - min) as u32 * 1000 / range as u32) as u32 }
            };

            total_intensity += val;
            weighted_sum += val as i32 * (i as i32 * 1000);
        }

        if total_intensity < 500 {
             // Line lost (roughly < 0.5 sensor active)
             return (0, 0); 
        }

        let position = weighted_sum / total_intensity as i32;
        // Shift to be centered around 0
        // Range 0..7000 -> -3500..3500
        (position - 3500, total_intensity)
    }
}

