import React from 'react';
import {
  Activity,
  Cpu,
  Database,
  Layers,
  BarChart3,
  AlertTriangle,
  Cloud,
  HelpCircle,
  Zap,
  Terminal,
} from 'lucide-react';

export type TabId =
  | 'dashboard'
  | 'infrastructure'
  | 'benchmark'
  | 'queue'
  | 'cache'
  | 'architecture'
  | 'observability'
  | 'failure'
  | 'migration'
  | 'interview';

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Overview', icon: Activity },
    { id: 'infrastructure', label: 'Infrastructure', icon: Terminal },
    { id: 'benchmark', label: 'Benchmark Lab', icon: Zap },
    { id: 'queue', label: 'Live Queue', icon: Cpu },
    { id: 'cache', label: 'Cache Observatory', icon: Database },
    { id: 'architecture', label: 'AWS Architecture', icon: Layers },
    { id: 'observability', label: 'Telemetry', icon: BarChart3 },
    { id: 'failure', label: 'Failure Lab', icon: AlertTriangle },
    { id: 'migration', label: 'Cloud Migration', icon: Cloud },
    { id: 'interview', label: 'Interview Mode', icon: HelpCircle },
  ];

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 font-semibold shadow-sm">
              <Zap className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 text-lg tracking-tight block leading-tight">
                Cloud Observatory
              </span>
              <span className="text-xs text-slate-500 font-medium">AWS Event-Driven Optimization Platform</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
