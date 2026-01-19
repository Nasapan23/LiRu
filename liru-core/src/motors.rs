//! Motor control module for LiRu robot.
//!
//! This module provides a high-level interface for controlling two DC motors
//! using PWM signals through the L298N motor driver.

use embedded_hal::Pwm;
use embassy_stm32::gpio::OutputType;
use embassy_stm32::time::hz;
use embassy_stm32::timer::Channel;
use embassy_stm32::timer::simple_pwm::{PwmPin, SimplePwm};
use embassy_stm32::timer::low_level::CountingMode;
use embassy_stm32::peripherals::{PA8, PA9, PA10, PA11, TIM1};

/// PWM frequency for motor control (20kHz - inaudible)
const PWM_FREQUENCY: u32 = 20_000;

/// Motor identifier
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Motor {
    /// Left motor (Motor A)
    Left,
    /// Right motor (Motor B)
    Right,
}

/// Motor direction
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Direction {
    Forward,
    Reverse,
    Stop,
}

/// Motor controller for dual DC motors via L298N driver.
///
/// Uses TIM1 channels:
/// - CH1 (PA8): Motor A Forward
/// - CH2 (PA9): Motor A Reverse  
/// - CH3 (PA10): Motor B Forward
/// - CH4 (PA11): Motor B Reverse
pub struct MotorController<'d> {
    pwm: SimplePwm<'d, TIM1>,
    max_duty: u32,
}

impl<'d> MotorController<'d> {
    /// Create a new motor controller.
    ///
    /// # Arguments
    /// * `tim1` - TIM1 peripheral
    /// * `pa8` - PWM pin for Motor A forward
    /// * `pa9` - PWM pin for Motor A reverse
    /// * `pa10` - PWM pin for Motor B forward
    /// * `pa11` - PWM pin for Motor B reverse
    pub fn new(
        tim1: TIM1,
        pa8: PA8,
        pa9: PA9,
        pa10: PA10,
        pa11: PA11,
    ) -> Self {
        let pwm_a_fwd = PwmPin::new_ch1(pa8, OutputType::PushPull);
        let pwm_a_rev = PwmPin::new_ch2(pa9, OutputType::PushPull);
        let pwm_b_fwd = PwmPin::new_ch3(pa10, OutputType::PushPull);
        let pwm_b_rev = PwmPin::new_ch4(pa11, OutputType::PushPull);

        let mut pwm = SimplePwm::new(
            tim1,
            Some(pwm_a_fwd),
            Some(pwm_a_rev),
            Some(pwm_b_fwd),
            Some(pwm_b_rev),
            hz(PWM_FREQUENCY),
            CountingMode::EdgeAlignedUp,
        );

        let max_duty = pwm.get_max_duty();

        // Enable all channels
        pwm.enable(Channel::Ch1);
        pwm.enable(Channel::Ch2);
        pwm.enable(Channel::Ch3);
        pwm.enable(Channel::Ch4);

        // Start with motors stopped
        pwm.set_duty(Channel::Ch1, 0);
        pwm.set_duty(Channel::Ch2, 0);
        pwm.set_duty(Channel::Ch3, 0);
        pwm.set_duty(Channel::Ch4, 0);

        Self { pwm, max_duty }
    }

    /// Set motor speed and direction.
    ///
    /// # Arguments
    /// * `motor` - Which motor to control
    /// * `direction` - Direction of rotation
    /// * `speed_percent` - Speed as percentage (0-100)
    pub fn set_motor(&mut self, motor: Motor, direction: Direction, speed_percent: u8) {
        // Both motors use 1x power
        let adjusted_speed = speed_percent as u32;
        
        let speed = adjusted_speed.min(100);
        let duty = self.max_duty * speed / 100;

        let (fwd_ch, rev_ch) = match motor {
            Motor::Left => (Channel::Ch1, Channel::Ch2),
            Motor::Right => (Channel::Ch3, Channel::Ch4),
        };

        match direction {
            Direction::Forward => {
                self.pwm.set_duty(rev_ch, 0);
                self.pwm.set_duty(fwd_ch, duty);
            }
            Direction::Reverse => {
                self.pwm.set_duty(fwd_ch, 0);
                self.pwm.set_duty(rev_ch, duty);
            }
            Direction::Stop => {
                // HACK: Power Bank Keep-Alive
                // Instead of coasting (0,0), we drive Forward at 10% power.
                // This draws current to prevent the power bank from sleeping,
                // but should be too weak to move the motor (below static friction).
                let keep_alive_duty = self.max_duty * 10 / 100; // 10% Duty Cycle
                
                self.pwm.set_duty(rev_ch, 0);
                self.pwm.set_duty(fwd_ch, keep_alive_duty);
            }
        }
    }

    /// Set both motors at once (for differential drive).
    ///
    /// Positive values = forward, negative = reverse, 0 = stop.
    /// Range: -100 to 100 for each motor.
    pub fn set_both(&mut self, left_speed: i8, right_speed: i8) {
        let (left_dir, left_pct) = Self::speed_to_dir(left_speed);
        let (right_dir, right_pct) = Self::speed_to_dir(right_speed);

        self.set_motor(Motor::Left, left_dir, left_pct);
        self.set_motor(Motor::Right, right_dir, right_pct);
    }

    /// Stop all motors immediately.
    pub fn stop_all(&mut self) {
        self.pwm.set_duty(Channel::Ch1, 0);
        self.pwm.set_duty(Channel::Ch2, 0);
        self.pwm.set_duty(Channel::Ch3, 0);
        self.pwm.set_duty(Channel::Ch4, 0);
    }

    /// Drive forward at given speed percentage.
    pub fn forward(&mut self, speed_percent: u8) {
        self.set_motor(Motor::Left, Direction::Forward, speed_percent);
        self.set_motor(Motor::Right, Direction::Forward, speed_percent);
    }

    /// Drive backward at given speed percentage.
    pub fn backward(&mut self, speed_percent: u8) {
        self.set_motor(Motor::Left, Direction::Reverse, speed_percent);
        self.set_motor(Motor::Right, Direction::Reverse, speed_percent);
    }

    /// Turn left (pivot on the spot).
    pub fn turn_left(&mut self, speed_percent: u8) {
        self.set_motor(Motor::Left, Direction::Reverse, speed_percent);
        self.set_motor(Motor::Right, Direction::Forward, speed_percent);
    }

    /// Turn right (pivot on the spot).
    pub fn turn_right(&mut self, speed_percent: u8) {
        self.set_motor(Motor::Left, Direction::Forward, speed_percent);
        self.set_motor(Motor::Right, Direction::Reverse, speed_percent);
    }

    /// Convert signed speed (-100 to 100) to direction and absolute percentage.
    fn speed_to_dir(speed: i8) -> (Direction, u8) {
        if speed > 0 {
            (Direction::Forward, speed.min(100) as u8)
        } else if speed < 0 {
            (Direction::Reverse, (-speed).min(100) as u8)
        } else {
            (Direction::Stop, 0)
        }
    }
}
