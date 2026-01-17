interface SensorDisplayProps {
    sensorBinary: string;
    rawSensorData?: number[];
    onRequestSensors: () => void;
    disabled: boolean;
}

export function SensorDisplay({ sensorBinary, rawSensorData = [], onRequestSensors, disabled }: SensorDisplayProps) {
    const sensors = sensorBinary.split('').reverse(); // Reverse so index 0 is leftmost

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-gray-400 text-sm font-medium">LINE SENSORS</h3>
                <button
                    onClick={onRequestSensors}
                    disabled={disabled}
                    className="px-3 py-1 text-xs bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Refresh
                </button>
            </div>

            {/* Sensor visualization */}
            <div className="flex justify-center gap-1 h-32 items-end">
                {sensors.map((bit, index) => {
                    // Calculate height based on raw value if available (0-4095)
                    const rawValue = rawSensorData && rawSensorData[index] !== undefined ? rawSensorData[index] : 0;
                    const heightPercent = Math.min(100, Math.max(5, (rawValue / 4095) * 100));

                    return (
                        <div key={index} className="flex flex-col items-center gap-1">
                            <div
                                className={`w-8 rounded-t-lg flex items-center justify-center text-xs font-mono transition-all duration-200 ${bit === '1'
                                    ? 'bg-white text-gray-900 shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                                    }`}
                                style={{ height: `${heightPercent}%` }}
                            >
                                <span className="transform -rotate-90 text-[10px]">{rawValue}</span>
                            </div>
                            <span className="text-[10px] text-gray-500">{index + 1}</span>
                        </div>
                    );
                })}
            </div>

            {/* Binary pattern */}
            <div className="text-center">
                <span className="font-mono text-lg tracking-wider text-gray-300">
                    {sensorBinary}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                    Bar Height = Analog Value (0-4095)<br />
                    High Bar = Darker Surface (&lt; 1500 ?)
                </p>
            </div>
        </div>
    );
}
