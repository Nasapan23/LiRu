#![no_std]
#![no_main]

use defmt::info;
use embassy_executor::Spawner;
use embassy_stm32::adc::Adc;
use embassy_stm32::gpio::{Level, Output, Speed};
use embassy_stm32::Config;
use embassy_time::Timer;
use {defmt_rtt as _, panic_probe as _};

defmt::timestamp!("{=u64}", { embassy_time::Instant::now().as_millis() });

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let p = embassy_stm32::init(Config::default());

    info!("=== Sensor Debug Mode ===");

    // LED for visual feedback
    let mut led = Output::new(p.PA5, Level::Low, Speed::Low);

    // Initialize ADC
    let mut adc = Adc::new(p.ADC1);

    // Sensor pins (same as sensors.rs)
    // PA0, PA1, PA4, PB0, PC1, PC0, PC3, PC2
    let mut pin_s1 = p.PA0;
    let mut pin_s2 = p.PA1;
    let mut pin_s3 = p.PA4;
    let mut pin_s4 = p.PB0;
    let mut pin_s5 = p.PC1;
    let mut pin_s6 = p.PC0;
    let mut pin_s7 = p.PC3;
    let mut pin_s8 = p.PC2;

    info!("ADC initialized, starting sensor readings...");
    info!("Format: S1 S2 S3 S4 S5 S6 S7 S8");

    loop {
        // Read all 8 sensors
        let s1 = adc.blocking_read(&mut pin_s1);
        let s2 = adc.blocking_read(&mut pin_s2);
        let s3 = adc.blocking_read(&mut pin_s3);
        let s4 = adc.blocking_read(&mut pin_s4);
        let s5 = adc.blocking_read(&mut pin_s5);
        let s6 = adc.blocking_read(&mut pin_s6);
        let s7 = adc.blocking_read(&mut pin_s7);
        let s8 = adc.blocking_read(&mut pin_s8);

        // Print all values
        info!("ADC: {} {} {} {} {} {} {} {}", 
            s1, s2, s3, s4, s5, s6, s7, s8);

        // Toggle LED to show we're running
        led.toggle();

        // Wait 500ms between readings
        Timer::after_millis(500).await;
    }
}
