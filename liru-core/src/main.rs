#![no_std]
#![no_main]

use embedded_hal::Pwm;
use defmt::info;
use embassy_executor::Spawner;
use embassy_stm32::gpio::{Level, Output, OutputType, Speed};
use embassy_stm32::time::hz;
use embassy_stm32::timer::Channel;
use embassy_stm32::timer::simple_pwm::{PwmPin, SimplePwm};
use embassy_stm32::timer::low_level::CountingMode;
use embassy_stm32::Config;
use embassy_time::Timer;
use {defmt_rtt as _, panic_probe as _};

defmt::timestamp!("{=u64}", { embassy_time::Instant::now().as_millis() });

#[embassy_executor::task]
async fn blink_task(mut led: Output<'static>) {
    loop {
        led.toggle();
        Timer::after_millis(500).await;
    }
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_stm32::init(Config::default());

    info!("LiRu Motor PWM Test Started!");

    let led = Output::new(p.PA5, Level::Low, Speed::Low);
    spawner.spawn(blink_task(led)).unwrap();

    let pwm_a_fwd = PwmPin::new_ch1(p.PA8, OutputType::PushPull);
    let pwm_a_rev = PwmPin::new_ch2(p.PA9, OutputType::PushPull);
    let pwm_b_fwd = PwmPin::new_ch3(p.PA10, OutputType::PushPull);
    let pwm_b_rev = PwmPin::new_ch4(p.PA11, OutputType::PushPull);

    let mut pwm = SimplePwm::new(
        p.TIM1,
        Some(pwm_a_fwd),
        Some(pwm_a_rev),
        Some(pwm_b_fwd),
        Some(pwm_b_rev),
        hz(20_000),
        CountingMode::EdgeAlignedUp,
    );

    let max = pwm.get_max_duty();

    pwm.enable(Channel::Ch1);
    pwm.enable(Channel::Ch2);
    pwm.enable(Channel::Ch3);
    pwm.enable(Channel::Ch4);

    let mut all_off = |p: &mut SimplePwm<'_, _>| {
        p.set_duty(Channel::Ch1, 0);
        p.set_duty(Channel::Ch2, 0);
        p.set_duty(Channel::Ch3, 0);
        p.set_duty(Channel::Ch4, 0);
    };

    loop {
        info!("Motor A Forward");
        all_off(&mut pwm);
        pwm.set_duty(Channel::Ch1, (max * 70) / 100);
        Timer::after_secs(2).await;

        info!("All off");
        all_off(&mut pwm);
        Timer::after_millis(700).await;
    }
}
