import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export const ObservabilityDashboard: React.FC = () => {
  const throughputData = [
    { time: '10:00', serial: 5, parallel: 42, cacheHits: 40 },
    { time: '10:05', serial: 5, parallel: 45, cacheHits: 44 },
    { time: '10:10', serial: 5, parallel: 52, cacheHits: 50 },
    { time: '10:15', serial: 5, parallel: 48, cacheHits: 46 },
    { time: '10:20', serial: 5, parallel: 60, cacheHits: 58 },
    { time: '10:25', serial: 5, parallel: 58, cacheHits: 55 },
  ];

  const latencyDistribution = [
    { batchSize: '10 Jobs', serial: 1500, parallel: 180, cached: 12 },
    { batchSize: '20 Jobs', serial: 3000, parallel: 210, cached: 14 },
    { batchSize: '50 Jobs', serial: 7500, parallel: 240, cached: 18 },
    { batchSize: '100 Jobs', serial: 15000, parallel: 290, cached: 22 },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          <span>CloudWatch System Telemetry & Observability</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Real-time metrics: Throughput concurrency, execution latency distributions, and cache efficiency.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Throughput Comparison */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
          <h3 className="text-xs font-semibold text-slate-800 mb-4 flex items-center justify-between">
            <span>System Throughput (Jobs / Sec)</span>
            <span className="text-[10px] text-sky-700 bg-sky-100 px-2 py-0.5 rounded font-mono">Live Metric</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="parallel" name="Parallel (SQS+Lambda)" stroke="#0284c7" fill="#0284c7" fillOpacity={0.15} />
                <Area type="monotone" dataKey="cacheHits" name="Cached Read Throughput" stroke="#0d9488" fill="#0d9488" fillOpacity={0.15} />
                <Area type="monotone" dataKey="serial" name="Serial Loop Baseline" stroke="#d97706" fill="#d97706" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Latency Distribution */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
          <h3 className="text-xs font-semibold text-slate-800 mb-4 flex items-center justify-between">
            <span>Execution Latency Distribution (ms)</span>
            <span className="text-[10px] text-teal-700 bg-teal-100 px-2 py-0.5 rounded font-mono">Benchmark Scaling</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latencyDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="batchSize" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="serial" name="Serial (ms)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="parallel" name="Parallel (ms)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cached" name="Cached (ms)" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
