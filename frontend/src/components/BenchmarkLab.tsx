import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Clock, Zap, Database, ArrowUpRight } from 'lucide-react';
import { runBenchmark, BenchmarkResponse } from '../services/apiClient';

interface BenchmarkLabProps {
  onBenchmarkComplete?: (result: BenchmarkResponse) => void;
}

export const BenchmarkLab: React.FC<BenchmarkLabProps> = ({ onBenchmarkComplete }) => {
  const [selectedJobCount, setSelectedJobCount] = useState<number>(20);
  const [running, setRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    setRunning(true);
    setError(null);

    try {
      // Execute real benchmark against backend REST API
      const res = await runBenchmark(selectedJobCount, 40);
      setResult(res);
      if (onBenchmarkComplete) onBenchmarkComplete(res);
    } catch (err: any) {
      setError(err.message || 'Benchmark execution failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <Zap className="h-5 w-5 text-sky-600" />
            <span>Performance Benchmarking Laboratory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time measured performance: Local Sequential Baseline vs AWS SQS + Lambda Fan-out vs Memory/Redis Cache.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {[10, 20, 50, 100].map((count) => (
              <button
                key={count}
                disabled={running}
                onClick={() => setSelectedJobCount(count)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  selectedJobCount === count
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {count} Jobs
              </button>
            ))}
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={running}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
          >
            {running ? <span className="animate-spin text-sm">⏳</span> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{running ? 'Benchmarking...' : `Benchmark ${selectedJobCount} Jobs`}</span>
          </button>
        </div>
      </div>

      {/* Progress Indicator */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sky-800 text-xs flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
              <span className="font-mono">Executing Serial Baseline vs Parallel SQS/Lambda Workload ({selectedJobCount} Jobs)...</span>
            </div>
            <span className="text-slate-400 font-mono text-[11px]">Backend API Benchmark Engine</span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-mono">
          Error: {error}
        </div>
      )}

      {/* Results View */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
              <span className="text-xs font-medium text-amber-800 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Serial Duration</span>
              </span>
              <div className="text-xl font-bold text-amber-900 mt-2">
                {(result.serialDurationMs / 1000).toFixed(2)} sec
              </div>
              <span className="text-[11px] text-amber-700/80">N={result.jobCount} sequential loop</span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4">
              <span className="text-xs font-medium text-sky-800 flex items-center space-x-1">
                <Zap className="h-3.5 w-3.5 text-sky-600" />
                <span>Parallel Duration</span>
              </span>
              <div className="text-xl font-bold text-sky-900 mt-2">
                {(result.parallelDurationMs / 1000).toFixed(2)} sec
              </div>
              <span className="text-[11px] text-sky-700/80">SQS + Lambda fan-out</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
              <span className="text-xs font-medium text-emerald-800 flex items-center space-x-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                <span>Speedup</span>
              </span>
              <div className="text-xl font-bold text-emerald-900 mt-2">
                {result.improvementPercentage}%
              </div>
              <span className="text-[11px] text-emerald-700/80">Improvement factor</span>
            </div>

            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4">
              <span className="text-xs font-medium text-teal-800 flex items-center space-x-1">
                <Database className="h-3.5 w-3.5 text-teal-600" />
                <span>Cache Hit Rate</span>
              </span>
              <div className="text-xl font-bold text-teal-900 mt-2">
                {Math.round(result.cacheHitRate * 100)}%
              </div>
              <span className="text-[11px] text-teal-700/80">{result.databaseReadsSaved} DB reads saved</span>
            </div>
          </div>

          {/* Telemetry Details Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Execution Metric</th>
                  <th className="p-3">Serial Execution</th>
                  <th className="p-3">Parallel SQS + Lambda</th>
                  <th className="p-3">Parallel + Redis Cache</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Total Latency</td>
                  <td className="p-3 text-amber-700">{result.serialDurationMs} ms</td>
                  <td className="p-3 text-sky-700 font-semibold">{result.parallelDurationMs} ms</td>
                  <td className="p-3 text-teal-700 font-semibold">{result.cachedDurationMs} ms</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">System Throughput</td>
                  <td className="p-3 text-slate-500">{(result.jobCount / (result.serialDurationMs / 1000)).toFixed(1)} jobs/s</td>
                  <td className="p-3 text-slate-900 font-semibold">{result.throughputJobsPerSec} jobs/s</td>
                  <td className="p-3 text-teal-700 font-semibold">{(result.jobCount / (Math.max(1, result.cachedDurationMs) / 1000)).toFixed(1)} jobs/s</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Database Reads Required</td>
                  <td className="p-3">{result.jobCount} reads</td>
                  <td className="p-3">{result.jobCount} reads</td>
                  <td className="p-3 text-emerald-700 font-semibold">{result.databaseReadsSaved} reads saved</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};
