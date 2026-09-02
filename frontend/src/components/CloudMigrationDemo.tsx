import React, { useState } from 'react';
import { Cloud, CheckCircle } from 'lucide-react';

export const CloudMigrationDemo: React.FC = () => {
  const [activeStage, setActiveStage] = useState<number>(3);

  const migrationPhases = [
    { phase: 1, title: 'Phase 1: Dual Writes & Data Replication', desc: 'Existing serial monolith replicates batch write requests asynchronously to DynamoDB.' },
    { phase: 2, title: 'Phase 2: Validation & Canary Comparison', desc: 'Parallel SQS + Lambda workers execute in shadow mode to validate result parity.' },
    { phase: 3, title: 'Phase 3: Weighted Traffic Shift (Route 53)', desc: 'Weighted DNS shifts 20% → 50% → 100% API traffic to AWS API Gateway & SQS.' },
    { phase: 4, title: 'Phase 4: Monolith Decommissioning', desc: 'Legacy serial loops retired. 100% of workload operates on event-driven serverless.' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <Cloud className="h-5 w-5 text-sky-600" />
          <span>Cloud Migration & Re-Architecting Interactive Guide</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Demonstrating zero-downtime migration from a serial monolith to AWS event-driven serverless architecture.
        </p>
      </div>

      {/* Migration Strategy Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <span className="text-xs font-bold uppercase text-slate-500">Pattern 1</span>
          <h3 className="text-sm font-bold text-slate-800 mt-1">Lift-and-Shift (Rehost)</h3>
          <p className="text-xs text-slate-500 mt-2">
            Moves VM workloads directly to AWS EC2 without code modifications. Preserves serial bottlenecks.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <span className="text-xs font-bold uppercase text-slate-500">Pattern 2</span>
          <h3 className="text-sm font-bold text-slate-800 mt-1">Re-platform (Refactor)</h3>
          <p className="text-xs text-slate-500 mt-2">
            Migrates database to Amazon RDS PostgreSQL. Retains core synchronous execution loop.
          </p>
        </div>

        <div className="bg-sky-50 border border-sky-300 p-4 rounded-xl">
          <span className="text-xs font-bold uppercase text-sky-700 bg-sky-100 px-2 py-0.5 rounded">Selected Pattern</span>
          <h3 className="text-sm font-bold text-sky-900 mt-1">Re-architect (Serverless)</h3>
          <p className="text-xs text-sky-800 mt-2">
            Transforms serial monolith into decoupled SQS + Lambda workers with Redis caching. Eliminates bottlenecks.
          </p>
        </div>
      </div>

      {/* Interactive Low-Downtime Traffic Shift Timeline */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
        <h3 className="text-xs font-semibold uppercase text-slate-700">Zero-Downtime Migration Phases</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {migrationPhases.map((m) => (
            <button
              key={m.phase}
              onClick={() => setActiveStage(m.phase)}
              className={`p-3 rounded-lg border text-left transition-all ${
                activeStage === m.phase
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono">Phase {m.phase}</span>
                {activeStage === m.phase && <CheckCircle className="h-4 w-4 text-white" />}
              </div>
              <p className="text-[11px] font-medium mt-1">{m.title}</p>
            </button>
          ))}
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg text-xs">
          <span className="font-bold text-slate-900">{migrationPhases[activeStage - 1].title}</span>
          <p className="text-slate-600 mt-1">{migrationPhases[activeStage - 1].desc}</p>
        </div>
      </div>
    </div>
  );
};
