import React, { useState, useEffect } from 'react';
import { BarChart3, Cloud, Activity, Layers, Cpu, ShieldCheck, RefreshCw } from 'lucide-react';
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
import { getSystemMetrics, SystemMetricsResponse } from '../services/apiClient';

export const ObservabilityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      const data = await getSystemMetrics();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load system telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const queueData = [
    { name: 'Queue Depth (Visible)', value: metrics?.sqs.approximateNumberOfMessages ?? 0, fill: '#6366f1' },
    { name: 'In-Flight (Lambda)', value: metrics?.sqs.approximateNumberOfMessagesNotVisible ?? 0, fill: '#0284c7' },
    { name: 'Completed / Deleted', value: metrics?.sqs.messagesDeleted24h ?? 0, fill: '#10b981' },
  ];

  const lambdaData = [
    { name: 'Current Concurrency', value: metrics?.lambda.currentConcurrency ?? 0, limit: 10 },
    { name: 'Peak Concurrency', value: metrics?.lambda.peakConcurrency ?? 0, limit: 10 },
    { name: 'Reserved Limit', value: metrics?.lambda.configuredConcurrencyLimit ?? 10, limit: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <span>AWS Telemetry & Observability Observatory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time AWS CloudWatch telemetry and SQS/Lambda performance metrics with strict operational decoupling.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refreshed {lastRefreshed.toLocaleTimeString()}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. APPLICATION METRICS                                   */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Activity className="h-4 w-4 text-sky-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            1. Application Metrics (Workload Telemetry)
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Batches Created</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {metrics?.application.totalBatches ?? 0}
            </div>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
            <div className="text-[10px] font-semibold text-emerald-800 uppercase">Jobs Completed</div>
            <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">
              {metrics?.application.totalJobsCompleted ?? 0}
            </div>
          </div>

          <div className="p-3 bg-red-50/60 rounded-lg border border-red-200">
            <div className="text-[10px] font-semibold text-red-800 uppercase">Jobs Failed</div>
            <div className="text-lg font-bold font-mono text-red-900 mt-0.5">
              {metrics?.application.totalJobsFailed ?? 0}
            </div>
          </div>

          <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200">
            <div className="text-[10px] font-semibold text-sky-800 uppercase">Average Latency</div>
            <div className="text-lg font-bold font-mono text-sky-900 mt-0.5">
              {metrics?.application.averageJobDurationMs ?? 85} ms
            </div>
          </div>

          <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200">
            <div className="text-[10px] font-semibold text-indigo-800 uppercase">Latest Throughput</div>
            <div className="text-lg font-bold font-mono text-indigo-900 mt-0.5">
              {metrics?.application.latestBatchThroughput ?? 0} j/s
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. AWS INFRASTRUCTURE METRICS                            */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Cloud className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              2. AWS Infrastructure Metrics (CloudWatch & SQS / Lambda)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            Region: ap-south-1
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">SQS Visible (Backlog)</div>
            <div className="text-lg font-bold font-mono text-indigo-600 mt-0.5">
              {metrics?.sqs.approximateNumberOfMessages ?? 0}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">SQS In-Flight</div>
            <div className="text-lg font-bold font-mono text-sky-600 mt-0.5">
              {metrics?.sqs.approximateNumberOfMessagesNotVisible ?? 0}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Current Concurrency</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {metrics?.lambda.currentConcurrency ?? 0} / 10
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Peak Concurrency</div>
            <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
              {metrics?.lambda.peakConcurrency ?? 0}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">Reserved Concurrency</div>
            <div className="text-lg font-bold font-mono text-slate-700 mt-0.5">
              {metrics?.lambda.configuredConcurrencyLimit ?? 10}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 uppercase">CloudWatch Throttles</div>
            <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
              {metrics?.lambda.throttles ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CHARTS GRID                                           */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: SQS Message Distribution */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <h4 className="text-xs font-semibold text-slate-800 mb-3 flex items-center justify-between">
            <span>Amazon SQS Message Lifecycle</span>
            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
              Durable Queue
            </span>
          </h4>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={queueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip />
                <Bar dataKey="value" name="Message Count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Lambda Concurrency Scaling */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
          <h4 className="text-xs font-semibold text-slate-800 mb-3 flex items-center justify-between">
            <span>Lambda Execution Environments vs Limit</span>
            <span className="text-[10px] font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded">
              Autoscaling
            </span>
          </h4>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lambdaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis domain={[0, 12]} stroke="#64748b" fontSize={10} />
                <Tooltip />
                <Bar dataKey="value" name="Executions" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
