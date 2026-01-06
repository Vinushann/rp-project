import { Link } from 'react-router-dom';

const modules = [
  { 
    name: 'Vinushan', 
    path: '/vinushan', 
    color: 'bg-blue-500',
    description: 'Module description here'
  },
  { 
    name: 'Vishva', 
    path: '/vishva', 
    color: 'bg-green-500',
    description: 'Module description here'
  },
  { 
    name: 'Nandika', 
    path: '/nandika', 
    color: 'bg-purple-500',
    description: 'Module description here'
  },
  { 
    name: 'Ayathma', 
    path: '/ayathma', 
    color: 'bg-orange-500',
    description: 'Module description here'
  },
];

function HomePage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to RP Project Dashboard
        </h1>
        <p className="text-gray-600">
          Select a module from the sidebar or click on a card below to get started.
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Link
            key={module.path}
            to={module.path}
            className="card hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 ${module.color} rounded-lg flex items-center justify-center text-white font-bold text-xl`}>
                {module.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {module.name} Component
                </h2>
                <p className="text-gray-500 mt-1">
                  {module.description}
                </p>
                <p className="text-primary-600 text-sm mt-3 font-medium">
                  Open module →
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Start Guide */}
      <div className="mt-12 card bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Start Guide</h2>
        <div className="space-y-3 text-gray-600">
          <p>1. Make sure the backend is running: <code className="bg-gray-200 px-2 py-1 rounded text-sm">cd apps/backend && uvicorn app.main:app --reload</code></p>
          <p>2. Click on any module to open its page</p>
          <p>3. Use the "Ping Backend" button to test the connection</p>
          <p>4. Try the chat interface to test the API integration</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
