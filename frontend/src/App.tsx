import { useEffect, useState } from 'react';
import './App.css';
import { Ping, GetVersion } from '../wailsjs/go/binding/EngineBinding';

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Connecting...');
  const [version, setVersion] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeBackend = async () => {
      try {
        const pingResponse = await Ping();
        setBackendStatus(`Backend: ${pingResponse}`);

        const versionResponse = await GetVersion();
        setVersion(`v${versionResponse}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setBackendStatus('Backend: error');
      }
    };

    initializeBackend();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-indigo-600 mb-6">
          SIPFLOW
        </h1>

        <div className="space-y-3">
          <div className="text-center">
            <p className={`text-lg ${error ? 'text-red-600' : 'text-green-600'}`}>
              {backendStatus}
            </p>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-700">
              {version}
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
              <p className="text-sm text-red-600">
                Error: {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
