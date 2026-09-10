import React, { useState, useEffect } from 'react';
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
  Menu,
  X,
} from 'lucide-react';
import { getCloudSyncStatus, CloudSyncStatus } from '../services/apiClient';

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

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus | null>(null);

  useEffect(() => {
    getCloudSyncStatus()
      .then(setCloudStatus)
      .catch(() => {});
  }, []);

  const navItems: {
    id: TabId;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'dashboard', label: 'Overview', description: 'Platform KPIs & 3D Topology', icon: Activity },
    { id: 'infrastructure', label: 'Infrastructure', description: 'Terraform Deploy & Destroy', icon: Terminal, badge: 'IaC' },
    { id: 'benchmark', label: 'Benchmark Lab', description: 'Serial vs SQS Performance', icon: Zap },
    { id: 'queue', label: 'Live Queue', description: 'Real-Time Pipeline Visualizer', icon: Cpu, badge: 'Live' },
    { id: 'cache', label: 'Cache Observatory', description: 'Redis & Memory TTL Layer', icon: Database },
    { id: 'architecture', label: 'AWS Architecture', description: 'Cloud-Native Topology', icon: Layers },
    { id: 'observability', label: 'Telemetry', description: 'CloudWatch & Latency Metrics', icon: BarChart3 },
    { id: 'failure', label: 'Failure Lab', description: 'Chaos Engineering & DLQ', icon: AlertTriangle },
    { id: 'migration', label: 'Cloud Migration', description: 'Legacy Monolith Comparison', icon: Cloud },
    { id: 'interview', label: 'Interview Mode', description: 'System Design Q&A Guide', icon: HelpCircle },
  ];

  const handleNavClick = (id: TabId) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600">
            <Zap className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight block leading-tight">
              Cloud Observatory
            </span>
            <span className="text-[10px] text-slate-500">AWS Event-Driven Platform</span>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40"
        />
      )}

      {/* Vertical Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50 transition-transform duration-200 ease-in-out shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header / Brand */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-600 shadow-xs">
              <Zap className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-base tracking-tight block leading-tight">
                Cloud Observatory
              </span>
              <span className="text-[11px] text-slate-500 font-medium">AWS Event-Driven Platform</span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Platform Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                  isActive
                    ? 'bg-sky-50/80 text-sky-800 font-semibold border-l-4 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      isActive ? 'bg-sky-100 text-sky-700' : 'text-slate-400 group-hover:text-slate-600 bg-slate-100/70'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs block truncate">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block truncate font-normal">
                      {item.description}
                    </span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ml-2 ${
                      isActive
                        ? 'bg-sky-200/80 text-sky-800'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Cloud Infrastructure Health Card (Bottom) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>AWS Cloud</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {cloudStatus?.region || 'ap-south-1'}
              </span>
            </div>

            <div className="text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span>DynamoDB</span>
                <span
                  className={`text-[10px] font-medium ${
                    cloudStatus?.dynamoDbConnected ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {cloudStatus?.dynamoDbConnected ? 'Synced' : 'In-Memory'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>SQS Queue</span>
                <span
                  className={`text-[10px] font-medium ${
                    cloudStatus?.sqsConnected ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                >
                  {cloudStatus?.sqsConnected ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 text-center text-[10px] text-slate-400 font-mono">
            v1.0.0 • Terraform Dev Env
          </div>
        </div>
      </aside>
    </>
  );
};
