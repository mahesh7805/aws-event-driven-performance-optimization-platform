import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Zap, RefreshCcw, ShieldCheck, AlertCircle } from 'lucide-react';
import { queryJobWithCache, getCacheStats, CacheStatsResponse } from '../services/apiClient';

export const CacheObservatory: React.FC = () => {
  const [testJobId, setTestJobId] = useState<string>('job-123');
  const [stats, setStats] = useState<CacheStatsResponse>({ hits: 0, misses: 0, hitRate: 0, databaseReads: 0 });
  const [lastQueryResult, setLastQueryResult] = useState<{ cacheHit: boolean; duration: number; jobId: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const currentStats = await getCacheStats();
      setStats(currentStats);
    } catch (e) {
      console.error('Failed to fetch cache stats', e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTestQuery = async () => {
    setLoading(true);
    setError(null);
    const start = Date.now();
    try {
      const res = await queryJobWithCache(testJobId.trim());
      const duration = Date.now() - start;
      setLastQueryResult({ cacheHit: res.cacheHit, duration, jobId: testJobId.trim() });
      await fetchStats();
    } catch (err: any) {
      setError(err.message || 'Cache query failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
            <Database className="h-5 w-5 text-teal-600" />
            <span>In-Memory / Redis TTL Cache Observatory</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic TTL Read-Through Caching (`CACHE_TTL_SECONDS=60`). First lookup = MISS (DynamoDB Read), Second lookup of same key = HIT.
          </p>
        </div>

        <div className="flex items-center space-x-4 mt-3 sm:mt-0">
          <div className="bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg text-xs font-mono text-teal-900">
            Hit Rate: <span className="font-bold text-teal-700">{Math.round(stats.hitRate * 100)}%</span>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700">
            DB Reads Saved: <span className="font-bold text-slate-900">{stats.hits}</span>
          </div>
        </div>
      </div>

      {/* Interactive Cache Lookup Endpoint Tester */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold uppercase text-slate-700">Query Cache Key Endpoint</h3>
          <span className="text-[11px] text-slate-500 font-mono">GET /api/jobs/:jobId</span>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={testJobId}
            onChange={(e) => setTestJobId(e.target.value)}
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:border-teal-500"
            placeholder="e.g. job-123 or job-456"
          />
          <button
            onClick={handleTestQuery}
            disabled={loading || !testJobId.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center space-x-2 shadow-xs transition-all cursor-pointer"
          >
            {loading ? <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 fill-current" />}
            <span>Fetch '{testJobId}'</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {lastQueryResult && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border text-xs font-mono flex items-center justify-between ${
              lastQueryResult.cacheHit
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              {lastQueryResult.cacheHit ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <Database className="h-4 w-4 text-amber-600" />
              )}
              <span>
                Key: <strong className="underline">{lastQueryResult.jobId}</strong> &rarr; Status:{' '}
                {lastQueryResult.cacheHit
                  ? 'CACHE HIT (Retrieved instantly from Cache)'
                  : 'CACHE MISS (Fetched from Repository & Cached)'}
              </span>
            </div>
            <span className="font-bold">{lastQueryResult.duration} ms latency</span>
          </motion.div>
        )}
      </div>

      {/* Visual Flow Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Cache Hits</span>
          <span className="text-2xl font-bold text-teal-600 font-mono">{stats.hits}</span>
          <p className="text-[11px] text-slate-400 mt-1">Served directly from memory cache</p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Cache Misses</span>
          <span className="text-2xl font-bold text-amber-600 font-mono">{stats.misses}</span>
          <p className="text-[11px] text-slate-400 mt-1">Queried repository/DynamoDB & cached with TTL</p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Database Reads</span>
          <span className="text-2xl font-bold text-slate-800 font-mono">{stats.databaseReads}</span>
          <p className="text-[11px] text-slate-400 mt-1">Total physical database reads executed</p>
        </div>
      </div>
    </div>
  );
};
