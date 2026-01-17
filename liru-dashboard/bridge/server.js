/**
 * WebSocket-to-Serial Bridge for HC-05 Bluetooth
 * 
 * This server connects to the HC-05 via COM port and exposes
 * a WebSocket interface for the React dashboard.
 * 
 * Usage: node server.js
 */

const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const WS_PORT = 3001;

let serialPort = null;
let parser = null;

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

                case 'command':
                    if (serialPort && serialPort.isOpen) {
                        serialPort.write(message.data);
                        console.log(`→ Sent: ${message.data}`);
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
            baudRate: 9600,
        });

        parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

        serialPort.on('open', () => {
            console.log(`✅ Connected to ${portName}`);
            ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
        });

        parser.on('data', (data) => {
            console.log(`← Received: ${data}`);
            ws.send(JSON.stringify({ type: 'message', data }));
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
        parser = null;
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
