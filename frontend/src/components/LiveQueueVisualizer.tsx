import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, RefreshCw, CheckCircle2, AlertCircle, Database, Cloud } from 'lucide-react';
import { runParallelBatch, getBatchDetails, getCloudSyncStatus, CloudSyncStatus } from '../services/apiClient';

interface QueueJobItem {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  workerId?: string;
  duration?: number;
}

export const LiveQueueVisualizer: React.FC = () => {
  const [selectedJobCount, setSelectedJobCount] = useState<number>(20);
  const [jobs, setJobs] = useState<QueueJobItem[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus | null>(null);

  const fetchSyncStatus = async () => {
    try {
      const status = await getCloudSyncStatus();
      setSyncStatus(status);
    } catch {
      // Ignore background sync check errors
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const startLiveSimulation = async () => {
    setRunning(true);
    setJobs([]);

    try {
      // 1. Trigger backend Parallel Execution for selected job count
      const res = await runParallelBatch(selectedJobCount, 40);
      setBatchId(res.batch.batchId);

      // Set initial queued items
      const initialJobs: QueueJobItem[] = res.jobs.map((j, i) => ({
        id: j.jobId,
        status: j.status as any,
        workerId: `Lambda Worker ${(i % 10) + 1}`,
        duration: j.duration,
      }));
      setJobs(initialJobs);

      // Poll batch state until completion
      const pollInterval = setInterval(async () => {
        try {
          const updated = await getBatchDetails(res.batch.batchId);
          if (updated && updated.jobs) {
            setJobs(
              updated.jobs.map((j, i) => ({
                id: j.jobId,
                status: j.status as any,
                workerId: `Lambda Worker ${(i % 10) + 1}`,
                duration: j.duration,
              }))
            );
            if (updated.batch.completedJobs + updated.batch.failedJobs >= updated.batch.totalJobs) {
              clearInterval(pollInterval);
              setRunning(false);
            }
          }
        } catch {
          clearInterval(pollInterval);
          setRunning(false);
        }
      }, 150);
    } catch (err) {
      console.error('Parallel batch execution failed', err);
      setRunning(false);
    }
  };

  const queued = jobs.filter((j) => j.status === 'QUEUED');
  const processing = jobs.filter((j) => j.status === 'PROCESSING');
  const completed = jobs.filter((j) => j.status === 'COMPLETED');
  const failed = jobs.filter((j) => j.status === 'FAILED');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <Cpu className="h-5 w-5 text-indigo-600" />
            <span>Live SQS & Worker Queue Visualizer</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stage transitions: SQS Message Queue &rarr; Lambda Worker Pool &rarr; DynamoDB Persistence.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {syncStatus?.dynamoDbConnected ? (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <Database className="h-3 w-3 text-emerald-600" />
                <span>DynamoDB: {syncStatus.jobsTableName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <Database className="h-3 w-3 text-slate-400" />
                <span>DynamoDB: In-Memory Mode (Deploy infra to sync)</span>
              </span>
            )}

            {syncStatus?.sqsConnected && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Cloud className="h-3 w-3 text-indigo-600" />
                <span>AWS SQS Active ({syncStatus.region})</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Job Count Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {[10, 20, 50, 100].map((count) => (
              <button
                key={count}
                disabled={running}
                onClick={() => setSelectedJobCount(count)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedJobCount === count
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {count} Jobs
              </button>
            ))}
          </div>

          <button
            onClick={startLiveSimulation}
            disabled={running}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Processing...' : `Submit ${selectedJobCount} Jobs`}</span>
          </button>
        </div>
      </div>

      {batchId && (
        <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded-md flex justify-between">
          <span>Batch ID: <strong className="text-slate-800">{batchId}</strong></span>
          <span>Total: <strong>{jobs.length}</strong> | Queued: <strong className="text-slate-600">{queued.length}</strong> | Active: <strong className="text-sky-600">{processing.length}</strong> | Completed: <strong className="text-emerald-600">{completed.length}</strong> | Failed: <strong className="text-red-600">{failed.length}</strong></span>
        </div>
      )}

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

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <AnimatePresence>
              {queued.slice(0, 15).map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white border border-slate-200 p-2.5 rounded-lg text-xs font-mono shadow-xs flex items-center justify-between text-slate-700"
                >
                  <span className="truncate max-w-[120px]">{job.id}</span>
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">Enqueued</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {queued.length > 15 && (
              <div className="text-[10px] text-slate-400 text-center font-mono">+ {queued.length - 15} more in SQS queue</div>
            )}
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

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <AnimatePresence>
              {processing.slice(0, 15).map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="bg-white border border-sky-300 p-2.5 rounded-lg text-xs font-mono shadow-xs space-y-1"
                >
                  <div className="flex justify-between items-center text-sky-900 font-semibold">
                    <span className="truncate max-w-[120px]">{job.id}</span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-ping"></span>
                  </div>
                  <div className="text-[10px] text-sky-600 font-sans">{job.workerId}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {processing.length > 15 && (
              <div className="text-[10px] text-sky-500 text-center font-mono">+ {processing.length - 15} active workers</div>
            )}
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

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <AnimatePresence>
              {completed.slice(0, 15).map((job) => (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-emerald-200 p-2.5 rounded-lg text-xs font-mono shadow-xs flex justify-between items-center text-emerald-900"
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[100px]">{job.id}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans shrink-0">{job.duration}ms</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {completed.length > 15 && (
              <div className="text-[10px] text-emerald-600 text-center font-mono">+ {completed.length - 15} completed jobs</div>
            )}
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

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
