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
    requestSensors
  } = useRobotConnection();
  const [comPort, setComPort] = useState('COM12');
  const [speed, setSpeed] = useState(50);

  const handleConnect = () => {
    connect(comPort);
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">LR</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">LiRu Control</h1>
              <p className="text-gray-400 text-sm">Robot Dashboard</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Control panel */}
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

            {/* Sensor display */}
            <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
              <SensorDisplay
                sensorBinary={sensorBinary}
                rawSensorData={rawSensorData}
                onRequestSensors={requestSensors}
                disabled={!isConnected}
              />
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
                <button
                  onClick={() => sendMotor(-speed, speed)}
                  disabled={!isConnected}
                  className="px-6 py-3 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Spin Left
                </button>
                <button
                  onClick={() => sendMotor(speed, -speed)}
                  disabled={!isConnected}
                  className="px-6 py-3 bg-gray-700 text-white font-medium rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Spin Right
                </button>
              </div>
            </div>
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

            {/* Command log */}
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
