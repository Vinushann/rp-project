import { Link, Outlet, useLocation } from 'react-router-dom';

const modules = [
  { name: 'Vinushan', path: '/vinushan', color: 'bg-blue-500' },
  { name: 'Vishva', path: '/vishva', color: 'bg-green-500' },
  { name: 'Nandika', path: '/nandika', color: 'bg-purple-500' },
  { name: 'Ayathma', path: '/ayathma', color: 'bg-orange-500' },
];

function Layout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo Area */}
        <div className="p-6 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold">RP</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">RP Project</h1>
              <p className="text-xs text-gray-400">Research Dashboard</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Modules
          </p>
          <ul className="space-y-2">
            {modules.map((module) => {
              const isActive = location.pathname === module.path;
              return (
                <li key={module.path}>
                  <Link
                    to={module.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${module.color}`}></span>
                    <span>{module.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            © 2025 RP Project Team
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
