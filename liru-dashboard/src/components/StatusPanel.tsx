type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface StatusPanelProps {
    connectionState: ConnectionState;
    lastMessage: string;
    comPort: string;
    onComPortChange: (port: string) => void;
    onConnect: () => void;
    onDisconnect: () => void;
}

export function StatusPanel({
    connectionState,
    lastMessage,
    comPort,
    onComPortChange,
    onConnect,
    onDisconnect,
}: StatusPanelProps) {
    const statusColors = {
        disconnected: 'bg-red-500',
        connecting: 'bg-yellow-500 animate-pulse',
        connected: 'bg-green-500',
    };

    const statusText = {
        disconnected: 'Disconnected',
        connecting: 'Connecting...',
        connected: 'Connected',
    };

    return (
        <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
            <h3 className="text-gray-400 text-sm font-medium mb-4">CONNECTION STATUS</h3>

            {/* Status indicator */}
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-3 h-3 rounded-full ${statusColors[connectionState]}`} />
                <span className="text-white font-medium">{statusText[connectionState]}</span>
            </div>

            {/* COM Port input */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={comPort}
                    onChange={(e) => onComPortChange(e.target.value)}
                    placeholder="COM5"
                    disabled={connectionState !== 'disconnected'}
                    className="
            flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg
            text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
          "
                />

                {connectionState === 'disconnected' ? (
                    <button
                        onClick={onConnect}
                        className="
              px-4 py-2 bg-blue-600 text-white font-medium rounded-lg
              hover:bg-blue-500 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
                    >
                        Connect
                    </button>
                ) : (
                    <button
                        onClick={onDisconnect}
                        className="
              px-4 py-2 bg-red-600 text-white font-medium rounded-lg
              hover:bg-red-500 transition-colors
              focus:outline-none focus:ring-2 focus:ring-red-500
            "
                    >
                        Disconnect
                    </button>
                )}
            </div>

            {/* Last message */}
            <div className="bg-gray-900 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Last Response</p>
                <p className="text-green-400 font-mono text-sm min-h-[1.5rem]">
                    {lastMessage || '—'}
                </p>
            </div>
        </div>
    );
}
