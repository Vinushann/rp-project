/**
 * Vinushan Module Page
 * ====================
 * 
 * OWNER: Vinushan
 * 
 * This is the main page for the Vinushan module.
 * Edit this file to customize your module's UI.
 * 
 * The page includes:
 * - A ping button to test backend connection
 * - A chat interface to interact with your module's API
 * 
 * Feel free to add more components and features as needed.
 */

import PingButton from '../../components/PingButton';
import ChatBox from '../../components/ChatBox';

const MODULE_NAME = 'vinushan';

function VinushanPage() {
  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
            V
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Vinushan Component</h1>
        </div>
        <p className="text-gray-600">
          [Add your module description here]
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Ping & Status */}
        <div className="space-y-6">
          <PingButton moduleName={MODULE_NAME} />
          
          {/* Add more components here */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Module Info</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">API Prefix:</dt>
                <dd className="font-mono text-sm">/api/v1/{MODULE_NAME}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status:</dt>
                <dd className="text-green-600">Active</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right Column - Chat Interface */}
        <div>
          <ChatBox moduleName={MODULE_NAME} />
        </div>
      </div>

      {/* =============================================
          ADD YOUR CUSTOM COMPONENTS BELOW THIS LINE
          ============================================= */}
      
    </div>
  );
}

export default VinushanPage;
