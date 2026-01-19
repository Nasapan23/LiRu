/**
 * WebSocket-to-Serial Bridge for HC-05 Bluetooth
 * 
 * Protocol bytes (matching liru-core/src/bluetooth.rs):
 * Commands to robot:
 *   0x01 left right - Set motor speeds (-100 to 100)
 *   0x02            - Stop motors
 *   0x03            - Request sensor data
 *   0x04            - Ping
 * 
 * Messages from robot:
 *   0x10 byte       - Sensor data (8-bit pattern)
 *   0x11            - Pong
 *   0x12            - Connected
 * 
 * Usage: node server.js
 */

const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');

const WS_PORT = 3001;
const BAUD_RATE = 9600; // HC-05 default, change to 2000000 if configured

// Command constants (matching bluetooth.rs)
const CMD = {
    MOTOR: 0x01,
    STOP: 0x02,
    GET_SENSORS: 0x03,
    PING: 0x04,
    GET_RAW_SENSORS: 0x05,
    SET_MODE: 0x06,
    START: 0x07,
};

const MSG = {
    SENSORS: 0x10,
    PONG: 0x11,
    CONNECTED: 0x12,
    RAW_SENSORS: 0x13,
    DEBUG: 0x14,
    CALIBRATION_START: 0x15,
    CALIBRATION_END: 0x16,
    DEBUG_ANALOG: 0x17,
    ERROR: 0xFF,
};

let serialPort = null;

const wss = new WebSocketServer({ port: WS_PORT });

console.log(`🚀 WebSocket bridge started on ws://localhost:${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('📱 Client connected');

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'connect':
                    await connectSerial(message.port, ws);
                    break;

                case 'motor':
                    // Binary motor command: [CMD_MOTOR, left, right]
                    if (serialPort && serialPort.isOpen) {
                        const left = Math.max(-100, Math.min(100, message.left));
                        const right = Math.max(-100, Math.min(100, message.right));
                        const buf = Buffer.from([CMD.MOTOR, left & 0xFF, right & 0xFF]);
                        serialPort.write(buf);
                        console.log(`→ Motor: L=${left} R=${right}`);
                    }
                    break;

                case 'stop':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(Buffer.from([CMD.STOP]));
                        console.log(`→ Stop`);
                    }
                    break;

                case 'getSensors':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(Buffer.from([CMD.GET_SENSORS]));
                        console.log(`→ Request sensors`);
                    }
                    break;

                case 'getRawSensors':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(Buffer.from([CMD.GET_RAW_SENSORS]));
                        console.log(`→ Request raw sensors`);
                    }
                    break;

                case 'ping':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(Buffer.from([CMD.PING]));
                        console.log(`→ Ping`);
                    }
                    break;

                case 'setMode':
                    if (serialPort && serialPort.isOpen) {
                        const mode = message.mode === 1 ? 1 : 0;
                        serialPort.write(Buffer.from([CMD.SET_MODE, mode]));
                        console.log(`→ Set Mode: ${mode === 0 ? 'Car' : 'Line Follower'}`);
                    }
                    break;

                case 'start':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(Buffer.from([CMD.START]));
                        console.log('→ Start Calibration');
                    }
                    break;

                // Legacy text command support
                case 'command':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(message.data);
                        console.log(`→ Sent (legacy): ${message.data}`);
                    }
                    break;

                case 'disconnect':
                    disconnectSerial(ws);
                    break;
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('📱 Client disconnected');
        disconnectSerial(ws);
    });
});

async function connectSerial(portName, ws) {
    try {
        // Close existing connection properly
        if (serialPort && serialPort.isOpen) {
            console.log('Closing existing connection...');
            await new Promise((resolve) => {
                serialPort.close((err) => {
                    if (err) console.error('Error closing port:', err);
                    resolve();
                });
            });
            // Give Windows a moment to release the handle
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        serialPort = new SerialPort({
            path: portName,
            baudRate: BAUD_RATE,
        }, (err) => {
            if (err) {
                console.error(`Failed to open ${portName}:`, err.message);
                ws.send(JSON.stringify({ type: 'error', error: err.message }));
                serialPort = null;
            } else {
                console.log(`✅ Connected to ${portName}`);
                ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
            }
        });

        // Binary data handler
        serialPort.on('data', (data) => {
            for (let i = 0; i < data.length; i++) {
                const byte = data[i];

                switch (byte) {
                    case MSG.SENSORS:
                        // Next byte is sensor data
                        if (i + 1 < data.length) {
                            const sensorByte = data[++i];
                            console.log(`← Sensors: ${sensorByte.toString(2).padStart(8, '0')}`);
                            ws.send(JSON.stringify({
                                type: 'sensors',
                                data: sensorByte,
                                binary: sensorByte.toString(2).padStart(8, '0')
                            }));
                        }
                        break;

                    case MSG.RAW_SENSORS:
                        // Next 16 bytes are 8 x u16
                        if (i + 16 < data.length) {
                            const rawData = [];
                            for (let j = 0; j < 8; j++) {
                                const low = data[++i];
                                const high = data[++i];
                                const val = (high << 8) | low;
                                rawData.push(val);
                            }
                            console.log(`← Raw: ${rawData.join(', ')}`);
                            ws.send(JSON.stringify({
                                type: 'rawSensors',
                                data: rawData
                            }));
                        }
                        break;

                    case MSG.PONG:
                        console.log(`← Pong`);
                        ws.send(JSON.stringify({ type: 'pong' }));
                        break;

                    case MSG.CONNECTED:
                        console.log(`← Robot connected`);
                        ws.send(JSON.stringify({ type: 'robotConnected' }));
                        break;

                    case MSG.DEBUG:
                        // Debug message: mode, position, motor_action
                        if (i + 3 < data.length) {
                            const debugMode = data[++i];
                            const debugPosition = data[++i];
                            const debugMotorAction = data[++i];
                            const actionNames = ['STOP', 'FWD', 'LEFT', 'RIGHT'];
                            const modeNames = ['Car', 'LineIdle', 'LineCalib', 'LineRun'];
                            console.log(`← DEBUG: Mode=${modeNames[debugMode] || debugMode} Pos=${debugPosition.toString(2).padStart(8, '0')} Motor=${actionNames[debugMotorAction] || debugMotorAction}`);
                            ws.send(JSON.stringify({
                                type: 'debug',
                                mode: debugMode,
                                position: debugPosition,
                                motorAction: debugMotorAction
                            }));
                        }
                        break;

                    case MSG.DEBUG_ANALOG:
                        // [Type 0x17] [Pos_H] [Pos_L] [Int_H] [Int_L] [Steer] [L_Speed] [R_Speed]
                        if (i + 7 < data.length) {
                            const posH = data[++i];
                            const posL = data[++i];
                            // Combine signed 16-bit big endian
                            let pos = (posH << 8) | posL;
                            if (pos > 32767) pos -= 65536; // signed 16-bit

                            const intH = data[++i];
                            const intL = data[++i];
                            const intensity = (intH << 8) | intL;

                            const steerByte = data[++i];
                            let steering = steerByte;
                            if (steering > 127) steering -= 256; // signed 8-bit

                            const leftSpeed = data[++i];
                            const rightSpeed = data[++i];

                            const text = `Pos:${pos} Int:${intensity} St:${steering} L:${leftSpeed} R:${rightSpeed}`;
                            console.log(`← ANALOG: ${text}`);

                            ws.send(JSON.stringify({
                                type: 'debug',
                                mode: 3, // LineRunning assumption
                                position: 0,
                                motorAction: 0,
                                text: text
                            }));
                        }
                        break;

                    case MSG.CALIBRATION_START:
                        console.log('← Calibration Started');
                        ws.send(JSON.stringify({ type: 'calibrationStart' }));
                        break;

                    case MSG.CALIBRATION_END:
                        console.log('← Calibration Ended');
                        ws.send(JSON.stringify({ type: 'calibrationEnd' }));
                        break;

                    default:
                        // Ignore unrecognized bytes to reduce noise
                        // console.log(`← Raw: 0x${byte.toString(16)}`);
                        break;
                }
            }
        });

        serialPort.on('error', (err) => {
            console.error('Serial error:', err.message);
            ws.send(JSON.stringify({ type: 'error', error: err.message }));
        });

        serialPort.on('close', () => {
            console.log('Serial port closed');
            ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
        });

    } catch (err) {
        console.error('Failed to connect:', err.message);
        ws.send(JSON.stringify({ type: 'error', error: err.message }));
    }
}

function disconnectSerial(ws) {
    if (serialPort && serialPort.isOpen) {
        serialPort.close();
        serialPort = null;
        ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
    }
}

// List available ports on startup
SerialPort.list().then((ports) => {
    console.log('\n📋 Available COM ports:');
    ports.forEach((port) => {
        console.log(`   ${port.path} - ${port.manufacturer || 'Unknown'}`);
    });
    console.log('');
}).catch(console.error);
