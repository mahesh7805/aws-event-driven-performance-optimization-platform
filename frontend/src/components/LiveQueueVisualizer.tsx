import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { runParallelBatch } from '../services/apiClient';

interface QueueJobItem {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  workerId?: string;
  duration?: number;
}

export const LiveQueueVisualizer: React.FC = () => {
  const [jobs, setJobs] = useState<QueueJobItem[]>([]);
  const [running, setRunning] = useState<boolean>(false);

  const startLiveSimulation = async () => {
    setRunning(true);
    const total = 8;
    const initialJobs: QueueJobItem[] = Array.from({ length: total }, (_, i) => ({
      id: `job-sqs-${i + 1}`,
      status: 'QUEUED',
    }));
    setJobs(initialJobs);

    // Trigger backend parallel execution
    runParallelBatch(total, 120).catch(console.error);

    // Animate stage transitions
    for (let i = 0; i < total; i++) {
      await new Promise((r) => setTimeout(r, 200));
      setJobs((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'PROCESSING', workerId: `Lambda Worker ${(i % 4) + 1}` } : item
        )
      );

      setTimeout(() => {
        setJobs((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'COMPLETED', duration: 120 + Math.floor(Math.random() * 30) } : item
          )
        );
      }, 500);
    }

    setTimeout(() => setRunning(false), 800);
  };

  const queued = jobs.filter((j) => j.status === 'QUEUED');
  const processing = jobs.filter((j) => j.status === 'PROCESSING');
  const completed = jobs.filter((j) => j.status === 'COMPLETED');
  const failed = jobs.filter((j) => j.status === 'FAILED');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <Cpu className="h-5 w-5 text-indigo-600" />
            <span>Live SQS & Worker Queue Visualizer</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stage transitions: SQS Message Queue → Lambda Worker Pool → DynamoDB Persistence.
          </p>
        </div>

        <button
          onClick={startLiveSimulation}
          disabled={running}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'Simulating Batch...' : 'Simulate Queue Flow'}</span>
        </button>
      </div>

      {/* 4 Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Column 1: SQS Queued */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-slate-600">1. SQS Queued</span>
            <span className="text-xs bg-slate-200 text-slate-800 font-mono px-2 py-0.5 rounded-full font-bold">
              {queued.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[160px]">
            <AnimatePresence>
              {queued.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-mono shadow-xs flex items-center justify-between text-slate-700"
                >
                  <span>{job.id}</span>
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Enqueued</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {queued.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-10 italic">Queue empty</p>
            )}
          </div>
        </div>

        {/* Column 2: Lambda Processing */}
        <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-sky-800">2. Lambda Active</span>
            <span className="text-xs bg-sky-200 text-sky-900 font-mono px-2 py-0.5 rounded-full font-bold">
              {processing.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[160px]">
            <AnimatePresence>
              {processing.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="bg-white border border-sky-300 p-2.5 rounded-lg text-xs font-mono shadow-xs space-y-1"
                >
                  <div className="flex justify-between items-center text-sky-900 font-semibold">
                    <span>{job.id}</span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-ping"></span>
                  </div>
                  <div className="text-[10px] text-sky-600 font-sans">{job.workerId}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {processing.length === 0 && (
              <p className="text-xs text-sky-400 text-center py-10 italic">No active workers</p>
            )}
          </div>
        </div>

        {/* Column 3: Completed */}
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-emerald-800">3. Completed (DDB)</span>
            <span className="text-xs bg-emerald-200 text-emerald-900 font-mono px-2 py-0.5 rounded-full font-bold">
              {completed.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[160px]">
            <AnimatePresence>
              {completed.map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-emerald-200 p-2.5 rounded-lg text-xs font-mono shadow-xs flex justify-between items-center text-emerald-900"
                >
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{job.id}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans">{job.duration}ms</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {completed.length === 0 && (
              <p className="text-xs text-emerald-400 text-center py-10 italic">No completed jobs yet</p>
            )}
          </div>
        </div>

        {/* Column 4: DLQ / Failed */}
        <div className="bg-red-50/50 p-4 rounded-xl border border-red-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase text-red-800">4. DLQ / Failed</span>
            <span className="text-xs bg-red-200 text-red-900 font-mono px-2 py-0.5 rounded-full font-bold">
              {failed.length}
            </span>
          </div>

          <div className="space-y-2 min-h-[160px]">
            {failed.map((job) => (
              <div key={job.id} className="bg-white border border-red-200 p-2.5 rounded-lg text-xs font-mono shadow-xs text-red-800">
                <AlertCircle className="h-3.5 w-3.5 text-red-600 inline mr-1" />
                {job.id}
              </div>
            ))}
            {failed.length === 0 && (
              <p className="text-xs text-red-300 text-center py-10 italic">0 failures (100% healthy)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
