import { useEffect, useCallback } from 'react';

interface ControlPadProps {
    onCommand: (command: string) => void;
    disabled?: boolean;
}

export function ControlPad({ onCommand, disabled = false }: ControlPadProps) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (disabled) return;

        switch (e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                onCommand('W');
                break;
            case 's':
            case 'arrowdown':
                onCommand('S');
                break;
            case 'a':
            case 'arrowleft':
                onCommand('A');
                break;
            case 'd':
            case 'arrowright':
                onCommand('D');
                break;
            case ' ':
            case 'q':
                onCommand('Q');
                break;
            case 'e':
                onCommand('E');
                break;
        }
    }, [onCommand, disabled]);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        if (disabled) return;
        const key = e.key.toLowerCase();
        if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            onCommand('Q'); // Stop when key released
        }
    }, [onCommand, disabled]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

    const buttonClass = `
    w-16 h-16 rounded-xl font-bold text-xl
    transition-all duration-150 ease-out
    ${disabled
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-b from-gray-600 to-gray-700 text-white hover:from-gray-500 hover:to-gray-600 active:from-blue-500 active:to-blue-600 active:scale-95 shadow-lg hover:shadow-xl'}
  `;

    const handleClick = (cmd: string) => {
        if (!disabled) onCommand(cmd);
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <h3 className="text-gray-400 text-sm font-medium mb-2">DIRECTION CONTROL</h3>

            {/* Up button */}
            <div className="flex justify-center">
                <button
                    className={buttonClass}
                    onMouseDown={() => handleClick('W')}
                    onMouseUp={() => handleClick('Q')}
                    onMouseLeave={() => handleClick('Q')}
                    disabled={disabled}
                >
                    ▲
                </button>
            </div>

            {/* Left, Stop, Right */}
            <div className="flex gap-2">
                <button
                    className={buttonClass}
                    onMouseDown={() => handleClick('A')}
                    onMouseUp={() => handleClick('Q')}
                    onMouseLeave={() => handleClick('Q')}
                    disabled={disabled}
                >
                    ◄
                </button>
                <button
                    className={`${buttonClass} ${!disabled && 'bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600'}`}
                    onClick={() => handleClick('Q')}
                    disabled={disabled}
                >
                    ■
                </button>
                <button
                    className={buttonClass}
                    onMouseDown={() => handleClick('D')}
                    onMouseUp={() => handleClick('Q')}
                    onMouseLeave={() => handleClick('Q')}
                    disabled={disabled}
                >
                    ►
                </button>
            </div>

            {/* Down button */}
            <div className="flex justify-center">
                <button
                    className={buttonClass}
                    onMouseDown={() => handleClick('S')}
                    onMouseUp={() => handleClick('Q')}
                    onMouseLeave={() => handleClick('Q')}
                    disabled={disabled}
                >
                    ▼
                </button>
            </div>

            <p className="text-gray-500 text-xs mt-3">
                Use WASD or Arrow keys • Space to stop
            </p>
        </div>
    );
}
