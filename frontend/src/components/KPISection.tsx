import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Zap, Database, CheckCircle2, ArrowRight } from 'lucide-react';
import { BenchmarkResponse } from '../services/apiClient';

interface KPIProps {
  metrics: BenchmarkResponse | null;
}

export const KPISection: React.FC<KPIProps> = ({ metrics }) => {
  const serialTime = metrics ? (metrics.serialDurationMs / 1000).toFixed(2) + 's' : '4.00s';
  const parallelTime = metrics ? (metrics.parallelDurationMs / 1000).toFixed(2) + 's' : '0.45s';
  const improvement = metrics ? `${metrics.improvementPercentage}%` : '88.8%';
  const throughput = metrics ? `${metrics.throughputJobsPerSec} jobs/s` : '44.4 jobs/s';
  const cacheHitRate = metrics ? `${Math.round(metrics.cacheHitRate * 100)}%` : '100%';

  const cards = [
    { label: 'Serial Processing Time', value: serialTime, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Parallel Processing Time', value: parallelTime, icon: Zap, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Speed Improvement', value: improvement, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'System Throughput', value: throughput, icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Cache Hit Rate', value: cacheHitRate, icon: Database, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{card.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Serial vs Parallel Execution Flow Visual Comparator */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-base font-semibold text-slate-900 mb-1">Architecture Execution Flow Comparison</h3>
        <p className="text-xs text-slate-500 mb-6">
          Visualizing sequential processing bottleneck versus asynchronous SQS message fan-out across Lambda workers.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Serial Flow */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md">
                Version A — Serial Loop
              </span>
              <span className="text-xs font-mono text-slate-500">Latency = N × JobTime</span>
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto py-3">
              {[1, 2, 3, 4, 5].map((num) => (
                <React.Fragment key={num}>
                  <div className="px-3 py-2 bg-amber-500/10 border border-amber-400/40 rounded-lg text-xs font-mono text-amber-800 flex items-center justify-center min-w-[70px]">
                    Job {num}
                  </div>
                  {num < 5 && <ArrowRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Jobs execute sequentially in single process memory thread. Total latency scales linearly ($O(N)$).
            </p>
          </div>

          {/* Parallel Flow */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase text-sky-700 bg-sky-100 px-2.5 py-1 rounded-md">
                Version B — SQS + Lambda Fan-Out
              </span>
              <span className="text-xs font-mono text-slate-500">Latency ≈ Max(JobTime)</span>
            </div>

            <div className="flex items-center space-x-3 py-1">
              <div className="px-3 py-4 bg-indigo-500/10 border border-indigo-400/40 rounded-lg text-xs font-mono text-indigo-800 text-center font-medium">
                Request → SQS
              </div>
              <ArrowRight className="h-4 w-4 text-sky-400 shrink-0" />
              <div className="flex flex-col space-y-1.5 flex-1">
                {[1, 2, 3].map((num) => (
                  <motion.div
                    key={num}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: [0.95, 1, 0.95] }}
                    transition={{ repeat: Infinity, duration: 2, delay: num * 0.3 }}
                    className="px-3 py-1.5 bg-sky-500/10 border border-sky-400/40 rounded-md text-xs font-mono text-sky-800 flex justify-between items-center"
                  >
                    <span>Lambda Worker {num}</span>
                    <span className="text-[10px] bg-sky-200/60 px-1.5 py-0.5 rounded text-sky-900 font-semibold">Active</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              SQS queues messages and triggers concurrent Lambda workers in parallel ($O(1)$ constant time execution).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
