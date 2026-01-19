import { useState } from 'react';
import { ControlPad } from './components/ControlPad';
import { SpeedControl } from './components/SpeedControl';
import { StatusPanel } from './components/StatusPanel';
import { SensorDisplay } from './components/SensorDisplay';
import { useRobotConnection } from './hooks/useRobotConnection';

function App() {
  const {
    connectionState,
    lastMessage,
    sensorBinary,
    rawSensorData,
    connect,
    disconnect,
    sendCommand,
    sendMotor,
    sendStop,
    requestSensors,
    requestRawSensors,
    sendSetMode,
    sendStart,
    resetCalibration,
    setPollingEnabled,
    pollingEnabled,
    calibrationStatus,
    debugLog,
    clearDebugLog
  } = useRobotConnection();
  const [comPort, setComPort] = useState('COM12');
  const [speed, setSpeed] = useState(50);
  const [mode, setMode] = useState<'car' | 'line'>('car');

  const handleConnect = () => {
    connect(comPort);
  };

  const handleModeChange = (newMode: 'car' | 'line') => {
    setMode(newMode);
    sendSetMode(newMode);
    if (newMode === 'car') {
      setPollingEnabled(false);
    } else {
      // Reset calibration state when entering Line Follower mode
      resetCalibration();
      setPollingEnabled(false);
    }
  };

  // Sensor polling disabled for Line Follower - it interferes with robot operation
  // Only enable polling when explicitly needed

  const isConnected = connectionState === 'connected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold">LR</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">LiRu Control</h1>
                <p className="text-gray-400 text-sm">Robot Dashboard</p>
              </div>
            </div>
            {/* Mode Switcher in Header */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
              <button
                onClick={() => handleModeChange('car')}
                disabled={!isConnected}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'car'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Car Mode
              </button>
              <button
                onClick={() => handleModeChange('line')}
                disabled={!isConnected}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'line'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Line Follower
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Control panel - Only for Car Mode */}
            {mode === 'car' ? (
              <>
                <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm border border-gray-700/50">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-12">
                    <ControlPad onCommand={sendCommand} disabled={!isConnected} />
                    <SpeedControl
                      speed={speed}
                      onSpeedChange={setSpeed}
                      onSpeedCommand={sendCommand}
                      disabled={!isConnected}
                    />
                  </div>
                </div>

                {/* Quick actions */}
                <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                  <h3 className="text-gray-400 text-sm font-medium mb-4">QUICK ACTIONS</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={sendStop}
                      disabled={!isConnected}
                      className="px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Emergency Stop
                    </button>
                    <button
                      onClick={() => sendMotor(speed, speed)}
                      disabled={!isConnected}
                      className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Forward ({speed}%)
                    </button>
                    <button
                      onClick={() => sendMotor(-speed, -speed)}
                      disabled={!isConnected}
                      className="px-6 py-3 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reverse ({speed}%)
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Line Follower Mode Controls */
              <div className="space-y-6">
                <div className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm border border-gray-700/50 text-center">
                  <h2 className="text-2xl font-bold mb-4">Line Follower Mode</h2>

                  {calibrationStatus === 'idle' && (
                    <>
                      <p className="text-gray-400 mb-8">
                        Place the robot on the line. Press Start to begin the 10-second calibration phase.
                        During calibration, move the robot back and forth over the line to capture min/max values.
                      </p>
                      <button
                        onClick={sendStart}
                        disabled={!isConnected}
                        className="px-12 py-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xl font-bold rounded-2xl hover:from-purple-500 hover:to-blue-500 transition-all shadow-xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                      >
                        START CALIBRATION
                      </button>
                    </>
                  )}

                  {calibrationStatus === 'calibrating' && (
                    <div className="flex flex-col items-center animate-pulse">
                      <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                      <h3 className="text-xl font-bold text-purple-400 mb-2">Calibrating...</h3>
                      <p className="text-gray-300">Move the robot back and forth over the line.</p>
                    </div>
                  )}

                  {calibrationStatus === 'running' && (
                    <div className="flex flex-col items-center">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full mb-6">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Running Line Follower Logic
                      </div>

                      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                          <span className="text-xs text-gray-500 uppercase">Binary</span>
                          <div className="font-mono text-xl mt-1 tracking-widest">{sensorBinary}</div>
                        </div>
                        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                          <span className="text-xs text-gray-500 uppercase">Last Msg</span>
                          <div className="text-sm mt-1 truncate">{lastMessage}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Debug Log Panel - Always visible in Line Follower mode */}
                  <div className="mt-6 w-full max-w-lg mx-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-500 uppercase">Debug Log ({debugLog.length} entries)</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(debugLog.join('\n'));
                          }}
                          className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs rounded hover:bg-blue-600 hover:text-white transition-all"
                        >
                          Copy All
                        </button>
                        <button
                          onClick={clearDebugLog}
                          className="px-3 py-1 bg-gray-600/20 text-gray-400 text-xs rounded hover:bg-gray-600 hover:text-white transition-all"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700 h-40 overflow-y-auto font-mono text-xs">
                      {debugLog.length === 0 ? (
                        <div className="text-gray-500 text-center py-4">No debug messages yet</div>
                      ) : (
                        debugLog.map((msg, i) => (
                          <div key={i} className="text-gray-300 py-0.5 border-b border-gray-800 last:border-0">
                            {msg}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center gap-4">
                    <button
                      onClick={() => {
                        sendStop();
                        resetCalibration();
                        setPollingEnabled(false);
                      }}
                      disabled={!isConnected}
                      className="px-8 py-3 bg-red-600/20 text-red-400 border border-red-600/50 font-medium rounded-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                    >
                      STOP
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column - Status */}
          <div className="space-y-8">
            <StatusPanel
              connectionState={connectionState}
              lastMessage={lastMessage}
              comPort={comPort}
              onComPortChange={setComPort}
              onConnect={handleConnect}
              onDisconnect={disconnect}
            />

            {/* Raw Sensor Debug Panel */}
            <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-sm font-medium">RAW SENSOR DEBUG</h3>
                <button
                  onClick={() => setPollingEnabled(!pollingEnabled)}
                  disabled={!isConnected}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${pollingEnabled
                      ? 'bg-green-600 text-white hover:bg-green-500'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {pollingEnabled ? 'POLLING ON' : 'START POLL'}
                </button>
              </div>

              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                  const value = rawSensorData[i] ?? 0;
                  const percentage = (value / 4095) * 100;
                  // Flag potentially dead sensors
                  const isStuck = pollingEnabled && (value === 0 || value >= 4090);

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`text-xs font-mono w-6 ${isStuck ? 'text-red-400' : 'text-gray-500'}`}>
                        S{i + 1}
                      </span>
                      <div className="flex-1 h-4 bg-gray-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${isStuck
                              ? 'bg-red-500'
                              : value > 2000
                                ? 'bg-purple-500'
                                : 'bg-blue-500'
                            }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-12 text-right ${isStuck ? 'text-red-400' : 'text-gray-300'}`}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {pollingEnabled && rawSensorData.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-500 mb-1">Quick Reference</div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-gray-400">Low (white)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <span className="text-gray-400">High (black)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span className="text-gray-400">Stuck/Dead</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Command log */}
            {mode === 'car' && (
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                <h3 className="text-gray-400 text-sm font-medium mb-3">KEYBOARD SHORTCUTS</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Forward</span>
                    <span className="text-gray-300 font-mono">W / ↑</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reverse</span>
                    <span className="text-gray-300 font-mono">S / ↓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Turn Left</span>
                    <span className="text-gray-300 font-mono">A / ←</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Turn Right</span>
                    <span className="text-gray-300 font-mono">D / →</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Stop</span>
                    <span className="text-gray-300 font-mono">Q / Space</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/50 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-gray-500 text-sm text-center">
            LiRu Line-Following Robot • Nucleo F401RE + DRV8833 + HY-S301
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
