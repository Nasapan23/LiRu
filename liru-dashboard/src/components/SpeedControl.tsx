interface SpeedControlProps {
    speed: number;
    onSpeedChange: (speed: number) => void;
    onSpeedCommand: (level: string) => void;
    disabled?: boolean;
}

export function SpeedControl({ speed, onSpeedChange, onSpeedCommand, disabled = false }: SpeedControlProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSpeed = parseInt(e.target.value);
        onSpeedChange(newSpeed);
        // Map 10-100 to 1-9 for firmware
        const level = Math.floor(newSpeed / 10).toString();
        onSpeedCommand(level === '10' ? '9' : level);
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <h3 className="text-gray-400 text-sm font-medium">SPEED CONTROL</h3>

            <div className="relative w-48">
                {/* Speed gauge background */}
                <div className="h-4 bg-gradient-to-r from-green-600 via-yellow-500 to-red-600 rounded-full overflow-hidden shadow-inner">
                    <div
                        className="h-full bg-gray-800/60 transition-all duration-200"
                        style={{ width: `${100 - speed}%`, marginLeft: `${speed}%` }}
                    />
                </div>

                {/* Slider */}
                <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={speed}
                    onChange={handleChange}
                    disabled={disabled}
                    className={`
            absolute inset-0 w-full h-full opacity-0 cursor-pointer
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
                />
            </div>

            {/* Speed display */}
            <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white tabular-nums">{speed}</span>
                <span className="text-gray-500 text-lg">%</span>
            </div>

            {/* Quick select buttons */}
            <div className="flex gap-1 mt-2">
                {[25, 50, 75, 100].map((preset) => (
                    <button
                        key={preset}
                        onClick={() => {
                            onSpeedChange(preset);
                            onSpeedCommand(Math.floor(preset / 10).toString());
                        }}
                        disabled={disabled}
                        className={`
              px-3 py-1 text-xs font-medium rounded-md transition-all
              ${speed === preset
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                    >
                        {preset}%
                    </button>
                ))}
            </div>
        </div>
    );
}
