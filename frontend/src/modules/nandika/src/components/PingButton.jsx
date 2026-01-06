import { useState } from 'react';
import { pingModule } from '../lib/api';

/**
 * PingButton Component
 * ====================
 * A button to test the connection to a module's backend.
 * 
 * @param {string} moduleName - The module to ping
 */
function PingButton({ moduleName }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePing = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await pingModule(moduleName);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Backend Connection</h3>
        <button
          onClick={handlePing}
          disabled={isLoading}
          className="btn-secondary disabled:opacity-50"
        >
          {isLoading ? 'Pinging...' : 'Ping Backend'}
        </button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">✓ Connection Successful</p>
          <pre className="text-sm text-green-700 mt-2 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">✗ Connection Failed</p>
          <p className="text-sm text-red-700 mt-2">{error}</p>
          <p className="text-xs text-red-600 mt-2">
            Make sure the backend is running on port 8000
          </p>
        </div>
      )}

      {!result && !error && (
        <p className="text-gray-500 text-sm">
          Click "Ping Backend" to test the connection to the {moduleName} module.
        </p>
      )}
    </div>
  );
}

export default PingButton;
