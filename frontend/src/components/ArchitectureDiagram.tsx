import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Info, X } from 'lucide-react';

interface ComponentDetail {
  id: string;
  name: string;
  category: string;
  purpose: string;
  whyUsed: string;
  keyConfig: string;
  interviewConcept: string;
}

export const ArchitectureDiagram: React.FC = () => {
  const [selectedComp, setSelectedComp] = useState<ComponentDetail | null>(null);

  const components: ComponentDetail[] = [
    {
      id: 'apigw',
      name: 'API Gateway',
      category: 'Networking',
      purpose: 'REST API entry point routing external client HTTP requests to internal backend services.',
      whyUsed: 'Provides managed throttling, CORS security, request validation, and zero server provisioning.',
      keyConfig: 'REST API Type, Throttling Rate Limit: 10,000 rps, Burst Limit: 5,000.',
      interviewConcept: 'Decoupled API Routing & Rate Limiting.',
    },
    {
      id: 'sqs',
      name: 'Amazon SQS Queue',
      category: 'Messaging',
      purpose: 'Decouple message producers from asynchronous consumer workers.',
      whyUsed: 'Absorbs sudden workload traffic spikes without overloading downstream databases or services.',
      keyConfig: 'Visibility Timeout: 30s, Message Retention: 4 days, DLQ MaxReceiveCount: 3.',
      interviewConcept: 'Asynchronous Fan-out & Buffer-based Rate Flattening.',
    },
    {
      id: 'lambda',
      name: 'Lambda Parallel Workers',
      category: 'Compute',
      purpose: 'Event-driven compute workers that scale horizontally to process SQS messages in parallel.',
      whyUsed: 'Sub-second auto-scaling from 0 to 1,000+ concurrent worker instances; pay only per millisecond.',
      keyConfig: 'Memory: 512MB, Reserved Concurrency: 50, SQS Event Source Batch Size: 10.',
      interviewConcept: 'Stateless Horizontal Scaling & Concurrency Throttling.',
    },
    {
      id: 'ddb',
      name: 'Amazon DynamoDB',
      category: 'Database',
      purpose: 'NoSQL key-value database storing Job execution state and Batch benchmark telemetry.',
      whyUsed: 'Delivers single-digit millisecond latency at any scale with automatic data replication.',
      keyConfig: 'Partition Key: jobId, Sort Key: batchId, Billing Mode: PAY_PER_REQUEST (On-Demand).',
      interviewConcept: 'NoSQL Partitioning Keys & Single-Table Access Patterns.',
    },
    {
      id: 'cache',
      name: 'Redis / ElastiCache',
      category: 'In-Memory Cache',
      purpose: 'Sub-millisecond in-memory cache layer for frequently queried job records.',
      whyUsed: 'Prevents database read contention and cuts expensive read capacity units (RCU) by over 80%.',
      keyConfig: 'Engine: Redis 7.0, TTL: 60 seconds, Eviction Policy: volatile-lru.',
      interviewConcept: 'Read-Through Cache Pattern & Cache Stampede Mitigation.',
    },
    {
      id: 's3',
      name: 'Amazon S3',
      category: 'Object Storage',
      purpose: 'Persistent object storage for exported benchmark execution logs and audit artifacts.',
      whyUsed: 'Provides 99.999999999% (11 9s) durability at extremely low cost.',
      keyConfig: 'Bucket Lifecycle Policy: Archive to Glacier after 30 days, Server-Side Encryption: SSE-S3.',
      interviewConcept: 'Object Storage vs Block Storage & Event Notifications.',
    },
    {
      id: 'iam',
      name: 'AWS IAM Roles',
      category: 'Security',
      purpose: 'Define least-privilege security permissions for Lambda workers to interact with SQS and DynamoDB.',
      whyUsed: 'Enforces strict zero-trust security compliance with temporary STS credentials.',
      keyConfig: 'AWSLambdaSQSQueueExecutionRole, DynamoDBPutItem minimal inline policies.',
      interviewConcept: 'Least Privilege Access & IAM Role Delegation.',
    },
    {
      id: 'cloudwatch',
      name: 'Amazon CloudWatch',
      category: 'Observability',
      purpose: 'Centralized log aggregation, execution metrics, and alarm triggers.',
      whyUsed: 'Provides operational insight into Lambda cold starts, queue depth, and worker errors.',
      keyConfig: 'Metric Filters, Alarm Threshold: DLQ MessageCount > 0, Log Retention: 14 days.',
      interviewConcept: 'Distributed System Telemetry & Alarms.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <Layers className="h-5 w-5 text-sky-600" />
          <span>Interactive AWS Serverless Architecture Diagram</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Click any component to inspect architectural trade-offs, configuration settings, and interview concepts.
        </p>
      </div>

      {/* Component Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {components.map((comp) => (
          <motion.div
            key={comp.id}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedComp(comp)}
            className="bg-slate-50 border border-slate-200 hover:border-sky-300 p-4 rounded-xl cursor-pointer transition-all shadow-2xs group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                {comp.category}
              </span>
              <Info className="h-4 w-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mt-2">{comp.name}</h3>
            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{comp.purpose}</p>
          </motion.div>
        ))}
      </div>

      {/* Detail Drawer Modal */}
      <AnimatePresence>
        {selectedComp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white max-w-xl w-full rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-semibold uppercase text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-md">
                    {selectedComp.category}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedComp.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedComp(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-800">Primary Purpose</h4>
                  <p className="text-slate-600 mt-0.5">{selectedComp.purpose}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Why Selected</h4>
                  <p className="text-slate-600 mt-0.5">{selectedComp.whyUsed}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">Production Configuration</h4>
                  <code className="block bg-slate-100 p-2 rounded text-slate-700 mt-0.5 font-mono">
                    {selectedComp.keyConfig}
                  </code>
                </div>
                <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-sky-900">
                  <h4 className="font-semibold">Interview Concept</h4>
                  <p className="mt-0.5">{selectedComp.interviewConcept}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
