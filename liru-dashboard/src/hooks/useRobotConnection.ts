import { useState, useEffect, useCallback } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface UseRobotConnectionReturn {
    connectionState: ConnectionState;
    lastMessage: string;
    sensorData: number | null;
    sensorBinary: string;
    rawSensorData: number[];
    connect: (port: string) => void;
    disconnect: () => void;
    sendCommand: (command: string) => void;
    sendMotor: (left: number, right: number) => void;
    sendStop: () => void;
    requestSensors: () => void;
    requestRawSensors: () => void;
    sendPing: () => void;
}

export function useRobotConnection(): UseRobotConnectionReturn {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [lastMessage, setLastMessage] = useState<string>('');
    const [sensorData, setSensorData] = useState<number | null>(null);
    const [sensorBinary, setSensorBinary] = useState<string>('00000000');
    const [rawSensorData, setRawSensorData] = useState<number[]>([]);

    const connect = useCallback((port: string) => {
        setConnectionState('connecting');

        const socket = new WebSocket(`ws://localhost:3001`);

        socket.onopen = () => {
            setConnectionState('connected');
            // Send the COM port to connect to
            socket.send(JSON.stringify({ type: 'connect', port }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'message':
                    setLastMessage(data.data);
                    break;
                case 'sensors':
                    setSensorData(data.data);
                    setSensorBinary(data.binary || data.data.toString(2).padStart(8, '0'));
                    break;
                case 'rawSensors':
                    setRawSensorData(data.data);
                    break;
                case 'pong':
                    setLastMessage('Pong received');
                    break;
                case 'robotConnected':
                    setLastMessage('Robot connected');
                    break;
                case 'status':
                    if (data.status === 'disconnected') {
                        setConnectionState('disconnected');
                    }
                    break;
            }
        };

        socket.onclose = () => {
            setConnectionState('disconnected');
        };

        socket.onerror = () => {
            setConnectionState('disconnected');
        };

        setWs(socket);
    }, []);

    const disconnect = useCallback(() => {
        if (ws) {
            ws.close();
            setWs(null);
        }
        setConnectionState('disconnected');
    }, [ws]);

    // Legacy text command
    const sendCommand = useCallback((command: string) => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'command', data: command }));
        }
    }, [ws, connectionState]);

    // Binary motor command
    const sendMotor = useCallback((left: number, right: number) => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'motor', left, right }));
        }
    }, [ws, connectionState]);

    // Stop command
    const sendStop = useCallback(() => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'stop' }));
        }
    }, [ws, connectionState]);

    // Request sensor data
    const requestSensors = useCallback(() => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'getSensors' }));
        }
    }, [ws, connectionState]);

    // Request raw sensor data
    const requestRawSensors = useCallback(() => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'getRawSensors' }));
        }
    }, [ws, connectionState]);

    // Ping
    const sendPing = useCallback(() => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
    }, [ws, connectionState]);

    // Auto-poll sensors when connected
    useEffect(() => {
        if (connectionState === 'connected') {
            const interval = setInterval(() => {
                requestSensors();
                requestRawSensors();
            }, 100);
            return () => clearInterval(interval);
        }
    }, [connectionState, requestSensors, requestRawSensors]);

    useEffect(() => {
        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [ws]);

    return {
        connectionState,
        lastMessage,
        sensorData,
        sensorBinary,
        rawSensorData,
        connect,
        disconnect,
        sendCommand,
        sendMotor,
        sendStop,
        requestSensors,
        requestRawSensors,
        sendPing,
    };
}
