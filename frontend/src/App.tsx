import React, { useState } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { Hero3D } from './components/Hero3D';
import { KPISection } from './components/KPISection';
import { BenchmarkLab } from './components/BenchmarkLab';
import { LiveQueueVisualizer } from './components/LiveQueueVisualizer';
import { CacheObservatory } from './components/CacheObservatory';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { ObservabilityDashboard } from './components/ObservabilityDashboard';
import { FailureLab } from './components/FailureLab';
import { CloudMigrationDemo } from './components/CloudMigrationDemo';
import { InterviewMode } from './components/InterviewMode';
import { InfrastructureDeployment } from './components/InfrastructureDeployment';
import { BenchmarkResponse } from './services/apiClient';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [latestMetrics, setLatestMetrics] = useState<BenchmarkResponse | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <Hero3D />
              <KPISection metrics={latestMetrics} />
              <BenchmarkLab onBenchmarkComplete={setLatestMetrics} />
            </>
          )}

          {activeTab === 'infrastructure' && <InfrastructureDeployment />}

          {activeTab === 'benchmark' && (
            <BenchmarkLab onBenchmarkComplete={setLatestMetrics} />
          )}

          {activeTab === 'queue' && <LiveQueueVisualizer />}

          {activeTab === 'cache' && <CacheObservatory />}

          {activeTab === 'architecture' && <ArchitectureDiagram />}

          {activeTab === 'observability' && <ObservabilityDashboard />}

          {activeTab === 'failure' && <FailureLab />}

          {activeTab === 'migration' && <CloudMigrationDemo />}

          {activeTab === 'interview' && <InterviewMode />}
        </main>

        <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between">
            <p>© 2026 AWS Event-Driven Performance Optimization Platform.</p>
            <p className="mt-2 sm:mt-0 font-mono text-[11px] text-slate-400">
              Node.js + Express + SQS + Lambda + Redis + DynamoDB + R3F + React
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
