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
};

const MSG = {
    SENSORS: 0x10,
    PONG: 0x11,
    CONNECTED: 0x12,
    RAW_SENSORS: 0x13,
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
        // Close existing connection
        if (serialPort && serialPort.isOpen) {
            serialPort.close();
        }

        serialPort = new SerialPort({
            path: portName,
            baudRate: BAUD_RATE,
        });

        serialPort.on('open', () => {
            console.log(`✅ Connected to ${portName}`);
            ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
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

                    default:
                        // Legacy text message
                        console.log(`← Raw: 0x${byte.toString(16)}`);
                        ws.send(JSON.stringify({ type: 'raw', data: byte }));
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
