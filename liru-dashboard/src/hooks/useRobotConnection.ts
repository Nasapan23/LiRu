import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
export type CalibrationStatus = 'idle' | 'calibrating' | 'running';

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
    sendSetMode: (mode: 'car' | 'line') => void;
    sendStart: () => void;
    resetCalibration: () => void;
    pollingEnabled: boolean;
    setPollingEnabled: (enabled: boolean) => void;
    calibrationStatus: CalibrationStatus;
    debugLog: string[];
    clearDebugLog: () => void;
}

export function useRobotConnection(): UseRobotConnectionReturn {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [lastMessage, setLastMessage] = useState<string>('');
    const [sensorData, setSensorData] = useState<number | null>(null);
    const [sensorBinary, setSensorBinary] = useState<string>('00000000');
    const [rawSensorData, setRawSensorData] = useState<number[]>([]);
    const [calibrationStatus, setCalibrationStatus] = useState<CalibrationStatus>('idle');
    const [debugLog, setDebugLog] = useState<string[]>([]);

    // Ref to track calibration start time for debouncing
    const calibrationStartTime = useRef<number>(0);

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
                        setCalibrationStatus('idle');
                    }
                    break;
                case 'calibrationStart':
                    console.log('Received calibrationStart');
                    calibrationStartTime.current = Date.now();
                    setCalibrationStatus('calibrating');
                    break;
                case 'calibrationEnd':
                    // Only accept calibrationEnd if:
                    // 1. We started calibrating at least 5 seconds ago
                    // 2. This prevents spurious signals from raw data
                    const elapsed = Date.now() - calibrationStartTime.current;
                    console.log('Received calibrationEnd, elapsed:', elapsed);
                    if (calibrationStartTime.current > 0 && elapsed >= 5000) {
                        setCalibrationStatus('running');
                        calibrationStartTime.current = 0;
                    }
                    break;
                case 'debug':
                    const timestamp = new Date().toLocaleTimeString();
                    let debugMsg = "";

                    if (data.text) {
                        debugMsg = `[${timestamp}] ${data.text}`;
                    } else {
                        const actionNames = ['CENTER', 'LOST', 'LEFT', 'RIGHT'];
                        const modeNames = ['Car', 'LineIdle', 'LineCal', 'LineRun'];
                        const pos = (data.position || 0).toString(2).padStart(8, '0');
                        const action = actionNames[data.motorAction] || data.motorAction;
                        const modeName = modeNames[data.mode] || data.mode;
                        debugMsg = `[${timestamp}] ${modeName} | Pos:${pos} | Dir:${action}`;
                    }
                    setLastMessage(debugMsg);
                    setDebugLog(prev => [...prev.slice(-999), debugMsg]); // Keep last 1000 messages
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

    // Set Mode
    const sendSetMode = useCallback((mode: 'car' | 'line') => {
        if (ws && connectionState === 'connected') {
            const modeByte = mode === 'line' ? 1 : 0;
            ws.send(JSON.stringify({ type: 'setMode', mode: modeByte }));
        }
    }, [ws, connectionState]);

    const sendStart = useCallback(() => {
        if (ws && connectionState === 'connected') {
            console.log('Sending start command...');
            ws.send(JSON.stringify({ type: 'start' }));
        } else {
            console.log('Cannot send start: ws=', !!ws, 'connectionState=', connectionState);
        }
    }, [ws, connectionState]);

    const resetCalibration = useCallback(() => {
        setCalibrationStatus('idle');
    }, []);

    const [pollingEnabled, setPollingEnabled] = useState(false);

    // Auto-poll sensors when connected AND polling is enabled
    useEffect(() => {
        if (connectionState === 'connected' && pollingEnabled) {
            const interval = setInterval(() => {
                requestSensors();
                requestRawSensors();
            }, 100);
            return () => clearInterval(interval);
        }
    }, [connectionState, pollingEnabled, requestSensors, requestRawSensors]);

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
        sendSetMode,
        sendStart,
        resetCalibration,
        pollingEnabled,
        setPollingEnabled,
        calibrationStatus,
        debugLog,
        clearDebugLog: () => setDebugLog([]),
    };
}
