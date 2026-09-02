import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CornerDownRight } from 'lucide-react';
import { simulateFailure, FailureSimulationResponse } from '../services/apiClient';

export const FailureLab: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<string>('worker-failure');
  const [telemetry, setTelemetry] = useState<FailureSimulationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const scenarios = [
    { id: 'worker-failure', title: 'Worker Crash & SQS Retry', description: 'Simulate worker unhandled exception' },
    { id: 'duplicate-message', title: 'Duplicate SQS Message', description: 'Simulate at-least-once duplicate delivery' },
    { id: 'processing-timeout', title: 'Worker Execution Timeout', description: 'Simulate 15-second execution timeout' },
    { id: 'database-error', title: 'DynamoDB Write Failure', description: 'Simulate database throttling & DLQ routing' },
    { id: 'poison-pill', title: 'Poison Pill Message', description: 'Corrupted payload format isolation' },
    { id: 'throttling-backoff', title: 'DynamoDB Throttling Backoff', description: 'Full Jitter Exponential Backoff retry' },
  ];

  const handleSimulate = async (scenarioId: string) => {
    setActiveScenario(scenarioId);
    setLoading(true);
    try {
      const res = await simulateFailure(scenarioId);
      setTelemetry(res);
    } catch {
      // Local fallback telemetry if backend is offline
      setTelemetry({
        scenario: scenarioId,
        status: scenarioId === 'database-error' ? 'MOVED_TO_DLQ' : 'RETRY_HANDLED',
        sqsAction: 'SQS Visibility Timeout & Redrive Policy Triggered',
        outcome: scenarioId === 'database-error' ? 'Sent to Dead Letter Queue (DLQ)' : 'Handled gracefully',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>Fault Injection & Failure Laboratory</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Demonstrates system resilience: SQS Redrive Policies, Visibility Timeouts, Idempotency, and DLQ routing.
        </p>
      </div>

      {/* Scenario Picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            onClick={() => handleSimulate(sc.id)}
            disabled={loading}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeScenario === sc.id
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <h3 className="text-xs font-bold text-slate-900">{sc.title}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{sc.description}</p>
          </button>
        ))}
      </div>

      {/* Interactive Simulation Output */}
      {telemetry && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-slate-100 p-6 rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-amber-400 font-bold uppercase">Scenario: {telemetry.scenario}</span>
            <span className="text-slate-400 text-[10px]">{telemetry.timestamp}</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <CornerDownRight className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400">SQS Queue System Behavior:</span>
                <p className="text-sky-300 font-semibold mt-0.5">{telemetry.sqsAction}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <CornerDownRight className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400">Resolution & Outcome:</span>
                <p className="text-emerald-300 font-semibold mt-0.5">{telemetry.outcome}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
