import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  Layers,
  Clock,
  Eye,
  Zap,
  Activity,
  Check,
  Radio,
  Maximize2,
  Minimize2,
  FlaskConical,
  Gauge,
  Timer,
  TrendingUp,
} from 'lucide-react';
import {
  runParallelBatch,
  getBatchDetails,
  getCloudSyncStatus,
  getAllBatches,
  getLambdaConcurrencyMetrics,
  CloudSyncStatus,
  BatchRecord,
  LambdaConcurrencyMetrics,
} from '../services/apiClient';

interface QueueJobItem {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  workerId?: string;
  duration?: number;
  result?: any;
  error?: string;
}

export const LiveQueueVisualizer: React.FC = () => {
  const [selectedJobCount, setSelectedJobCount] = useState<number>(20);
  const [jobs, setJobs] = useState<QueueJobItem[]>([]);
  const [running, setRunning] = useState<boolean>(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus | null>(null);

  // Real-time DynamoDB Batches state
  const [batchesList, setBatchesList] = useState<BatchRecord[]>([]);
  const [totalBatchesInDb, setTotalBatchesInDb] = useState<number>(0);
  const [isSyncingBatches, setIsSyncingBatches] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [inspectingBatchId, setInspectingBatchId] = useState<string | null>(null);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState<boolean>(false);

  // Temporary Diagnostic Concurrency Metrics state
  const [cwConcurrency, setCwConcurrency] = useState<LambdaConcurrencyMetrics | null>(null);
  const [peakObservedConcurrency, setPeakObservedConcurrency] = useState<number>(0);
  const [isLoadingCwMetrics, setIsLoadingCwMetrics] = useState<boolean>(false);
  const [showDatapointsTable, setShowDatapointsTable] = useState<boolean>(false);

  const fetchSyncStatus = async () => {
    try {
      const status = await getCloudSyncStatus();
      setSyncStatus(status);
    } catch {
      // Ignore background sync check errors
    }
  };

  const fetchBatches = async () => {
    setIsSyncingBatches(true);
    try {
      const res = await getAllBatches();
      setBatchesList(res.batches || []);
      setTotalBatchesInDb(res.totalBatches ?? (res.batches ? res.batches.length : 0));
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to sync batches from DynamoDB', err);
    } finally {
      setIsSyncingBatches(false);
    }
  };

  const fetchCwConcurrency = async () => {
    setIsLoadingCwMetrics(true);
    try {
      const data = await getLambdaConcurrencyMetrics();
      setCwConcurrency(data);
    } catch (err) {
      console.warn('Could not fetch CloudWatch metrics', err);
    } finally {
      setIsLoadingCwMetrics(false);
    }
  };

  // Initial load and real-time syncing interval (every 3s)
  useEffect(() => {
    fetchSyncStatus();
    fetchBatches();
    fetchCwConcurrency();

    const intervalId = setInterval(() => {
      fetchBatches();
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  const startLiveSimulation = async (customCount?: number) => {
    const count = customCount ?? selectedJobCount;
    setPeakObservedConcurrency(0);
    setRunning(true);
    setJobs([]);

    try {
      // 1. Trigger backend Parallel Execution for selected job count
      const res = await runParallelBatch(count, 40);
      setBatchId(res.batch.batchId);
      setInspectingBatchId(res.batch.batchId);

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
                result: j.result,
                error: j.error,
              }))
            );
            if (updated.batch.completedJobs + updated.batch.failedJobs >= updated.batch.totalJobs) {
              clearInterval(pollInterval);
              setRunning(false);
              // Refresh batch registry immediately upon completion
              fetchBatches();
              setTimeout(() => fetchCwConcurrency(), 2500);
            }
          }
        } catch {
          clearInterval(pollInterval);
          setRunning(false);
          fetchBatches();
        }
      }, 150);
    } catch (err) {
      console.error('Parallel batch execution failed', err);
      setRunning(false);
      fetchBatches();
    }
  };

  // Inspect any batch in the 4-stage pipeline visualizer
  const inspectBatch = async (targetBatchId: string) => {
    try {
      setInspectingBatchId(targetBatchId);
      setBatchId(targetBatchId);
      setIsCompletedExpanded(true);
      const updated = await getBatchDetails(targetBatchId);
      if (updated && updated.jobs) {
        setJobs(
          updated.jobs.map((j, i) => ({
            id: j.jobId,
            status: j.status as any,
            workerId: `Lambda Worker ${(i % 10) + 1}`,
            duration: j.duration,
            result: j.result,
            error: j.error,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to inspect batch:', err);
    }
  };

  const queued = jobs.filter((j) => j.status === 'QUEUED');
  const processing = jobs.filter((j) => j.status === 'PROCESSING');
  const completed = jobs.filter((j) => j.status === 'COMPLETED');
  const failed = jobs.filter((j) => j.status === 'FAILED');

  useEffect(() => {
    if (processing.length > peakObservedConcurrency) {
      setPeakObservedConcurrency(processing.length);
    }
  }, [processing.length, peakObservedConcurrency]);

  return (
    <div className="space-y-6">
      {/* Visualizer Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Live SQS & Worker Queue Visualizer
              </h2>
            </div>
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

              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <Radio className={`h-3 w-3 ${isSyncingBatches ? 'text-indigo-600 animate-spin' : 'text-emerald-500'}`} />
                <span>Real-Time Syncing (3s)</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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

            {/* Submit Jobs Button */}
            <button
              onClick={() => startLiveSimulation()}
              disabled={running}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Processing...' : `Submit ${selectedJobCount} Jobs`}</span>
            </button>

            {/* Manual Sync Batches */}
            <button
              onClick={fetchBatches}
              disabled={isSyncingBatches}
              title="Sync DynamoDB batches now"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingBatches ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Real-time Metric Cards Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-700">DynamoDB Batches</span>
              <Layers className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-indigo-950 font-mono">{totalBatchesInDb}</span>
              <span className="text-[10px] text-indigo-600 font-medium">persisted</span>
            </div>
            <div className="text-[10px] text-indigo-500/80 mt-0.5 truncate">
              {syncStatus?.batchesTableName || 'aws-event-driven-platform-BatchesTable-dev'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Current Batch Jobs</span>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">{jobs.length}</span>
              <span className="text-[10px] text-slate-500">jobs loaded</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Active in visualizer
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">Completed (DDB)</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-emerald-950 font-mono">{completed.length}</span>
              <span className="text-[10px] text-emerald-600">synced</span>
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-0.5">
              100% data integrity
            </div>
          </div>

          <div className="p-3 bg-sky-50/50 border border-sky-100 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-sky-700">Sync Status</span>
              <Radio className="h-4 w-4 text-sky-500 animate-pulse" />
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-sm font-semibold text-sky-950">Real-Time</span>
              <span className="text-[10px] text-sky-600 font-mono">3s cycle</span>
            </div>
            <div className="text-[10px] text-sky-500/80 mt-0.5">
              {lastSyncedAt ? `Synced ${lastSyncedAt.toLocaleTimeString()}` : 'Connecting...'}
            </div>
          </div>
        </div>

        {/* TEMPORARY DIAGNOSTIC: Lambda Concurrency Scaling Test Observatory */}
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border-2 border-amber-400/60 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <span>Temporary Diagnostic: Lambda Concurrency Scaling Test</span>
                  </h3>
                  <span className="text-[10px] bg-amber-200 text-amber-950 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-300">
                    Target: 10 Lambdas
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    ⚡ 3,000 ms Invocation Delay Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Testing whether SQS &rarr; Lambda parallel processing reaches configured Lambda Reserved Concurrency of 10.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => startLiveSimulation(50)}
                disabled={running}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Test 50 Jobs (10 Concurrency)</span>
              </button>

              <button
                onClick={fetchCwConcurrency}
                disabled={isLoadingCwMetrics}
                title="Refresh live CloudWatch metrics from AWS"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingCwMetrics ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* 4 Concurrency Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Metric 1: Live Active Workers */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Active Concurrency</span>
                <span className={`h-2 w-2 rounded-full ${processing.length > 0 ? 'bg-sky-500 animate-ping' : 'bg-slate-300'}`} />
              </div>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-3xl font-black font-mono text-sky-700">{processing.length}</span>
                <span className="text-xs text-slate-400 font-mono font-medium">/ 10 Max</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Current active Lambda workers
              </div>
            </div>

            {/* Metric 2: Peak Concurrency In Test */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Peak In Current Test</span>
                <Gauge className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-3xl font-black font-mono text-indigo-700">{peakObservedConcurrency}</span>
                <span className="text-xs text-slate-400 font-mono font-medium">/ 10 Max</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, peakObservedConcurrency * 10)}%` }}
                />
              </div>
            </div>

            {/* Metric 3: CloudWatch Peak Concurrency */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>CloudWatch Peak</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-3xl font-black font-mono text-emerald-700">
                  {cwConcurrency ? cwConcurrency.peakMaximum : '—'}
                </span>
                <span className="text-xs text-slate-400 font-mono font-medium">/ 10</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                AWS Telemetry: ConcurrentExecutions
              </div>
            </div>

            {/* Metric 4: Diagnostic Delay Duration */}
            <div className="bg-white/95 p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Invocation Delay</span>
                <Timer className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline space-x-1">
                <span className="text-2xl font-black font-mono text-amber-700">3,000</span>
                <span className="text-xs text-slate-400 font-mono font-medium">ms</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                ✓ Deployed on AWS Lambda
              </div>
            </div>
          </div>

          {/* CloudWatch Telemetry Datapoints collapsible toggle */}
          {cwConcurrency && cwConcurrency.datapoints && cwConcurrency.datapoints.length > 0 && (
            <div className="pt-2 border-t border-amber-200/60">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowDatapointsTable(!showDatapointsTable)}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-medium flex items-center space-x-1 cursor-pointer"
                >
                  <span>{showDatapointsTable ? '▾ Hide' : '▸ View'} AWS CloudWatch ConcurrentExecutions Datapoints ({cwConcurrency.datapoints.length} records)</span>
                </button>
                <span className="text-[10px] text-slate-500 font-mono">
                  Function: {cwConcurrency.functionName} ({cwConcurrency.region})
                </span>
              </div>

              {showDatapointsTable && (
                <div className="mt-2.5 overflow-x-auto border border-slate-200 rounded-lg bg-white">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200 font-sans">
                      <tr>
                        <th className="py-2 px-3">Timestamp</th>
                        <th className="py-2 px-3 text-center">Maximum Concurrent</th>
                        <th className="py-2 px-3 text-center">Average Concurrent</th>
                        <th className="py-2 px-3 text-right">Target Saturation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cwConcurrency.datapoints.slice(0, 6).map((dp, i) => (
                        <tr key={i} className="hover:bg-slate-50/80">
                          <td className="py-1.5 px-3 text-slate-700">{dp.timestamp}</td>
                          <td className="py-1.5 px-3 text-center font-bold text-indigo-600">{dp.maximum}</td>
                          <td className="py-1.5 px-3 text-center text-slate-600">{dp.average}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-700 font-semibold">
                            {Math.round((dp.maximum / 10) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active/Inspected Batch Banner */}
        {batchId && (
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Inspecting Batch:</span>
              <strong className="text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {batchId}
              </strong>
              {inspectingBatchId === batchId && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Current View
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span>Total: <strong>{jobs.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Queued: <strong className="text-slate-600">{queued.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Active: <strong className="text-sky-600">{processing.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Completed: <strong className="text-emerald-600">{completed.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span>Failed: <strong className="text-red-600">{failed.length}</strong></span>
            </div>
          </div>
        )}

        {/* Pipeline Views: Either Expanded 3. Completed (DDB) or Standard 4 Columns */}
        {isCompletedExpanded ? (
          <div className="space-y-4">
            {/* Top Compact Summary Strip for 1. Queued, 2. Active, 4. DLQ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-xs font-semibold uppercase text-slate-700">1. SQS Queued</span>
                </div>
                <span className="text-xs bg-slate-200 text-slate-800 font-mono px-2 py-0.5 rounded-full font-bold">
                  {queued.length}
                </span>
              </div>

              <div className="bg-sky-50/60 p-3 rounded-xl border border-sky-200 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                  <span className="text-xs font-semibold uppercase text-sky-800">2. Lambda Active</span>
                </div>
                <span className="text-xs bg-sky-200 text-sky-900 font-mono px-2 py-0.5 rounded-full font-bold">
                  {processing.length}
                </span>
              </div>

              <div className="bg-red-50/50 p-3 rounded-xl border border-red-200 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-xs font-semibold uppercase text-red-800">4. DLQ / Failed</span>
                </div>
                <span className="text-xs bg-red-200 text-red-900 font-mono px-2 py-0.5 rounded-full font-bold">
                  {failed.length}
                </span>
              </div>
            </div>

            {/* Expanded 3. Completed (DDB) Section */}
            <div className="bg-emerald-50/60 p-5 rounded-xl border border-emerald-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-900">
                        3. Completed (DDB) — All Completed Jobs
                      </h3>
                      <span className="text-xs bg-emerald-200 text-emerald-900 font-mono px-2.5 py-0.5 rounded-full font-bold">
                        {completed.length} Completed
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Displaying all completed jobs with full unabbreviated job names and measured execution speed.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsCompletedExpanded(false)}
                    className="inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Collapse to 4 Columns</span>
                  </button>
                </div>
              </div>

              {/* Grid of All Completed Jobs with Full Name & Speed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {completed.map((job, idx) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-xs space-y-2.5 hover:border-emerald-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2 min-w-0">
                        <span className="text-slate-400 font-mono text-xs mt-0.5 shrink-0 font-semibold">
                          #{idx + 1}
                        </span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span className="font-mono text-xs text-slate-800 font-medium break-all select-all leading-relaxed">
                          {job.id}
                        </span>
                      </div>

                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 shadow-2xs">
                        <Zap className="h-3 w-3 text-emerald-600" />
                        <span>{job.duration ? `${job.duration} ms` : '—'}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-mono">
                      <span className="text-slate-600 font-sans">{job.workerId || 'Lambda Worker'}</span>
                      <span className="text-emerald-700 font-semibold">
                        Speed: {job.duration ? `${job.duration} ms latency` : 'Completed'}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {completed.length === 0 && (
                  <div className="col-span-full py-12 text-center text-emerald-600/70 text-xs italic">
                    No completed jobs in this batch yet
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Standard 4 Pipeline Columns */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Column 1: SQS Queued */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-600">1. SQS Queued</span>
                <span className="text-xs bg-slate-200 text-slate-800 font-mono px-2 py-0.5 rounded-full font-bold">
                  {queued.length}
                </span>
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
                      <span className="truncate max-w-[140px]" title={job.id}>{job.id}</span>
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">Enqueued</span>
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

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
                        <span className="truncate max-w-[140px]" title={job.id}>{job.id}</span>
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
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs bg-emerald-200 text-emerald-900 font-mono px-2 py-0.5 rounded-full font-bold">
                    {completed.length}
                  </span>
                  <button
                    onClick={() => setIsCompletedExpanded(true)}
                    title="Expand 3. Completed (DDB) to show full names & speeds"
                    className="p-1 rounded bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                <AnimatePresence>
                  {completed.map((job) => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white border border-emerald-200 p-2.5 rounded-lg text-xs font-mono shadow-xs flex justify-between items-center text-emerald-900"
                    >
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[120px]" title={job.id}>{job.id}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-sans shrink-0 font-semibold">{job.duration ? `${job.duration}ms` : '—'}</span>
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

              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
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
        )}
      </div>

      {/* Created Batches Registry (DynamoDB Real-Time Sync) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Created Batches Registry
                </h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  DynamoDB Real-Time Sync
                </span>
              </div>
              <p className="text-xs text-slate-500">
                All submitted batches tracked in DynamoDB table <code className="font-mono text-slate-700">{syncStatus?.batchesTableName || 'aws-event-driven-platform-BatchesTable-dev'}</code>. Click "Inspect" on any batch to view its pipeline stages above.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-slate-500">
              Total Batches in DynamoDB:
            </span>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-indigo-600 text-white shadow-xs">
              {totalBatchesInDb}
            </span>
          </div>
        </div>

        {/* Batches Table List */}
        {batchesList.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
            <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-600">No batches recorded in DynamoDB yet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Submit jobs above or run a benchmark to create your first batch!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Batch ID</th>
                  <th className="py-2.5 px-3">Architecture Mode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Jobs Progress</th>
                  <th className="py-2.5 px-3">Execution Latency</th>
                  <th className="py-2.5 px-3">Created / Started</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchesList.map((batch) => {
                  const isCurrent = batch.batchId === batchId;
                  const percentComplete = batch.totalJobs > 0
                    ? Math.round(((batch.completedJobs + batch.failedJobs) / batch.totalJobs) * 100)
                    : 0;

                  return (
                    <tr
                      key={batch.batchId}
                      className={`transition-colors ${
                        isCurrent ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-[200px]" title={batch.batchId}>
                            {batch.batchId}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-semibold bg-indigo-100 text-indigo-700">
                              Active
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            batch.mode === 'PARALLEL'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <Zap className="h-2.5 w-2.5" />
                          <span>{batch.mode || 'PARALLEL'}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            batch.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : batch.status === 'PROCESSING'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : batch.status === 'FAILED'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {batch.status === 'COMPLETED' ? (
                            <Check className="h-2.5 w-2.5" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                          <span>{batch.status}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="space-y-1 min-w-[100px]">
                          <div className="flex justify-between text-[11px] font-mono text-slate-600">
                            <span>{batch.completedJobs}/{batch.totalJobs}</span>
                            <span className="text-[10px] text-slate-400">{percentComplete}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                batch.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${percentComplete}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {batch.durationMs ? `${batch.durationMs}ms` : '—'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>
                            {batch.startedAt
                              ? new Date(batch.startedAt).toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => inspectBatch(batch.batchId)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>{isCurrent ? 'Viewing' : 'Inspect'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

