Complete Pinout Map
Port A (GPIOA)

PA2 - USART_TX_Pin (USART2 TX)
PA3 - USART_RX_Pin (USART2 RX)
PA5 - LD2_Pin (LED output)
PA6 - Line_Sensor_7_Pin (Input)
PA7 - Line_Sensor_8_Pin (Input)
PA8 - PWM_IN_4_Pin (TIM1_CH1)
PA9 - PWM_IN_3_Pin (TIM1_CH2)
PA10 - PWM_IN_2_Pin (TIM1_CH3)
PA11 - PWM_IN_1_Pin (TIM1_CH4)
PA12 - Line_Sensor_6_Pin (Input)
PA13 - TMS_Pin (Debug/SWD)
PA14 - TCK_Pin (Debug/SWD)

Port B (GPIOB)

PB3 - SWO_Pin (Debug/SWO)
PB8 - Line_Sensor_4_Pin (Input)
PB9 - Line_Sensor_5_Pin (Input)

Port C (GPIOC)

PC5 - Line_Sensor_1_Pin (Input)
PC6 - Bluetooth_TX_Pin (USART6 TX)
PC7 - Bluetooth_RX_Pin (USART6 RX)
PC8 - Line_Sensor_2_Pin (Input)
PC9 - Line_Sensor_3_Pin (Input)
PC13 - B1_Pin (Button input with interrupt)

Peripheral Assignments
USART2 (115200 baud):

TX: PA2
RX: PA3

USART6 (2000000 baud) - Bluetooth:

TX: PC6
RX: PC7

TIM1 PWM Channels:

CH1: PA8 (PWM_IN_4)
CH2: PA9 (PWM_IN_3)
CH3: PA10 (PWM_IN_2)
CH4: PA11 (PWM_IN_1 - Output Compare mode)

Line Sensors (8 total):

Sensor 1: PC5
Sensor 2: PC8
Sensor 3: PC9
Sensor 4: PB8
Sensor 5: PB9
Sensor 6: PA12
Sensor 7: PA6
Sensor 8: PA7
PB6 BLUETOOTH STATE