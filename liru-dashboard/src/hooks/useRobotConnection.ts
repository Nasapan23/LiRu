import { useState, useEffect, useCallback } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface UseRobotConnectionReturn {
    connectionState: ConnectionState;
    lastMessage: string;
    connect: (port: string) => void;
    disconnect: () => void;
    sendCommand: (command: string) => void;
}

export function useRobotConnection(): UseRobotConnectionReturn {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [lastMessage, setLastMessage] = useState<string>('');

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
            if (data.type === 'message') {
                setLastMessage(data.data);
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

    const sendCommand = useCallback((command: string) => {
        if (ws && connectionState === 'connected') {
            ws.send(JSON.stringify({ type: 'command', data: command }));
        }
    }, [ws, connectionState]);

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
        connect,
        disconnect,
        sendCommand,
    };
}
