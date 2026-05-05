import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ToastContainer } from './ui';

const SIDEBAR_STATE_KEY = 'rp-sidebar-collapsed';

const modules = [
  { name: 'ATHENA', path: '/vinushan', color: 'bg-blue-500' },
  { name: 'ExtractIQ', path: '/vishva', color: 'bg-green-500' },
  { name: 'SentiPulse', path: '/nandika', color: 'bg-purple-500' },
  { name: 'KPIForge', path: '/ayathma', color: 'bg-orange-500' },
];

function Layout() {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SIDEBAR_STATE_KEY)) ?? false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  return (
    <div className="flex min-h-screen">
      {/* Toast Notifications */}
      <ToastContainer />
      
      <aside
        className={`bg-gray-900 text-white flex flex-col border-r border-gray-800 transition-all duration-200 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`border-b border-gray-800 ${isSidebarCollapsed ? 'p-4' : 'p-6'}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold">RP</span>
              </div>
              {!isSidebarCollapsed && (
                <div>
                  <h1 className="font-bold text-lg">RP Project</h1>
                  <p className="text-xs text-gray-400">Research Dashboard</p>
                </div>
              )}
            </Link>

            {!isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="w-8 h-8 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <span aria-hidden="true">&lt;</span>
              </button>
            )}
          </div>

          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="mt-3 w-full h-8 rounded-md border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {!isSidebarCollapsed && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Modules
            </p>
          )}
          <ul className="space-y-2">
            {modules.map((module) => {
              const isActive = location.pathname === module.path;
              return (
                <li key={module.path}>
                  <Link
                    to={module.path}
                    title={module.name}
                    className={`flex items-center rounded-lg transition-colors ${
                      isSidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'
                    } ${
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${module.color}`}></span>
                    {!isSidebarCollapsed && <span>{module.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className={`border-t border-gray-800 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <p className={`text-xs text-gray-500 ${isSidebarCollapsed ? 'text-center' : 'text-center'}`}>
            {isSidebarCollapsed ? '© 2026' : '© 2026 RP Project Team'}
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
