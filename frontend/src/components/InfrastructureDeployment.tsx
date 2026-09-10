import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
  Check,
} from 'lucide-react';
import {
  TerraformCommandResult,
  TerraformPlanDetails,
  getTerraformStatus,
  runTerraformInit,
  runTerraformValidate,
  runTerraformPlan,
  runTerraformApply,
  runTerraformDestroy,
  getTerraformOutputs,
} from '../services/apiClient';

export type DeploymentStep =
  | 'idle'
  | 'initializing'
  | 'validating'
  | 'planning'
  | 'waiting_approval'
  | 'applying'
  | 'destroying'
  | 'success'
  | 'failed';

interface LogLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'success' | 'error' | 'info' | 'warning';
  text: string;
  timestamp: string;
}

export const InfrastructureDeployment: React.FC = () => {
  const [step, setStep] = useState<DeploymentStep>('idle');
  const [logs, setLogs] = useState<LogLine[]>([
    {
      id: 'init-0',
      type: 'info',
      text: 'Terraform Console initialized. Ready to inspect and deploy AWS event-driven infrastructure.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [activePlan, setActivePlan] = useState<{
    summary?: string;
    details?: TerraformPlanDetails;
    rawOutput: string;
  } | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showDestroyModal, setShowDestroyModal] = useState<boolean>(false);
  const [latestOutputs, setLatestOutputs] = useState<Record<string, any> | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  const isBusy =
    step === 'initializing' ||
    step === 'validating' ||
    step === 'planning' ||
    step === 'applying' ||
    step === 'destroying';

  // Initial load: check backend status and load existing outputs
  useEffect(() => {
    checkStatus();
    fetchOutputsSilently();
  }, []);

  // Handle auto-scrolling terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!terminalContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const addLog = (
    type: LogLine['type'],
    text: string
  ) => {
    const newEntry: LogLine = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      text,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  const clearTerminal = () => {
    setLogs([
      {
        id: `clear-${Date.now()}`,
        type: 'info',
        text: 'Console cleared. Standing by for Terraform commands.',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const checkStatus = async () => {
    try {
      const status = await getTerraformStatus();
      if (status.isBusy) {
        setStep(
          status.currentOperation === 'init'
            ? 'initializing'
            : status.currentOperation === 'validate'
            ? 'validating'
            : status.currentOperation === 'plan'
            ? 'planning'
            : status.currentOperation === 'apply'
            ? 'applying'
            : 'idle'
        );
      }
    } catch {
      // Ignore if offline
    }
  };

  const fetchOutputsSilently = async () => {
    try {
      const res = await getTerraformOutputs();
      if (res.success && res.outputs && Object.keys(res.outputs).length > 0) {
        setLatestOutputs(res.outputs);
      }
    } catch {
      // Ignore
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // --- Granular Commands ---

  const handleInit = async (): Promise<boolean> => {
    setStep('initializing');
    addLog('command', '$ terraform init');
    addLog('info', 'Initializing Terraform working directory...');

    try {
      const res = await runTerraformInit();
      if (res.stdout) addLog('stdout', res.stdout.trim());
      if (res.stderr) addLog('stderr', res.stderr.trim());

      if (res.success) {
        addLog('success', '✓ Terraform initialized successfully.');
        setStep('idle');
        return true;
      } else {
        addLog('error', `❌ Terraform init failed with exit code ${res.exitCode ?? 1}.`);
        setStep('failed');
        return false;
      }
    } catch (err: any) {
      addLog('error', `❌ Connection error: ${err.message}`);
      setStep('failed');
      return false;
    }
  };

  const handleValidate = async (): Promise<boolean> => {
    setStep('validating');
    addLog('command', '$ terraform validate');

    try {
      const res = await runTerraformValidate();
      if (res.stdout) addLog('stdout', res.stdout.trim());
      if (res.stderr) addLog('stderr', res.stderr.trim());

      if (res.success) {
        addLog('success', '✓ Terraform configuration is valid.');
        setStep('idle');
        return true;
      } else {
        addLog('error', `❌ Terraform validation failed with exit code ${res.exitCode ?? 1}.`);
        setStep('failed');
        return false;
      }
    } catch (err: any) {
      addLog('error', `❌ Connection error: ${err.message}`);
      setStep('failed');
      return false;
    }
  };

  const handlePlan = async (): Promise<TerraformCommandResult | null> => {
    setStep('planning');
    addLog('command', '$ terraform plan');
    addLog('info', 'Generating infrastructure execution plan against AWS...');

    try {
      const res = await runTerraformPlan();
      if (res.stdout) addLog('stdout', res.stdout.trim());
      if (res.stderr) addLog('stderr', res.stderr.trim());

      if (res.success) {
        const summary = res.summary || 'Plan generated successfully.';
        addLog('success', `✓ ${summary}`);
        setActivePlan({
          summary,
          details: res.planDetails,
          rawOutput: res.stdout,
        });
        setStep('waiting_approval');
        setShowApprovalModal(true);
        return res;
      } else {
        addLog('error', `❌ Terraform plan failed with exit code ${res.exitCode ?? 1}.`);
        setStep('failed');
        return null;
      }
    } catch (err: any) {
      addLog('error', `❌ Connection error: ${err.message}`);
      setStep('failed');
      return null;
    }
  };

  const handleApply = async (): Promise<boolean> => {
    setShowApprovalModal(false);
    setStep('applying');
    addLog('command', '$ terraform apply -auto-approve');
    addLog('info', 'Applying infrastructure changes to AWS in ap-south-1...');

    try {
      const res = await runTerraformApply();
      if (res.stdout) addLog('stdout', res.stdout.trim());
      if (res.stderr) addLog('stderr', res.stderr.trim());

      if (res.success) {
        addLog('success', '✓ Infrastructure deployed successfully! Resources provisioned.');
        setStep('success');
        if (res.outputs && Object.keys(res.outputs).length > 0) {
          setLatestOutputs(res.outputs);
        } else {
          fetchOutputsSilently();
        }
        return true;
      } else {
        addLog('error', `❌ Terraform apply failed with exit code ${res.exitCode ?? 1}.`);
        setStep('failed');
        return false;
      }
    } catch (err: any) {
      addLog('error', `❌ Connection error: ${err.message}`);
      setStep('failed');
      return false;
    }
  };

  const handleCancelApply = () => {
    setShowApprovalModal(false);
    setStep('idle');
    addLog('warning', 'Deployment cancelled by user. Terraform apply was NOT executed.');
  };

  const handleDestroy = async (): Promise<boolean> => {
    setShowDestroyModal(false);
    setStep('destroying');
    addLog('command', '$ terraform destroy -auto-approve');
    addLog('warning', '⚠️ Starting destruction of all Terraform-managed AWS infrastructure in ap-south-1...');

    try {
      const res = await runTerraformDestroy();
      if (res.stdout) addLog('stdout', res.stdout.trim());
      if (res.stderr) addLog('stderr', res.stderr.trim());

      if (res.success) {
        addLog('success', '✓ All infrastructure resources successfully destroyed.');
        setStep('idle');
        setLatestOutputs(null);
        return true;
      } else {
        addLog('error', `❌ Terraform destroy failed with exit code ${res.exitCode ?? 1}.`);
        setStep('failed');
        return false;
      }
    } catch (err: any) {
      addLog('error', `❌ Connection error: ${err.message}`);
      setStep('failed');
      return false;
    }
  };

  // --- Preferred One-Click Workflow: Deploy Infrastructure ---

  const handleDeployWorkflow = async () => {
    if (isBusy) return;

    addLog('info', '═══════════════════════════════════════════════════════════════');
    addLog('info', '🚀 STARTING AUTOMATED INFRASTRUCTURE DEPLOYMENT WORKFLOW');
    addLog('info', 'Sequence: terraform init → validate → plan → approval → apply');
    addLog('info', '═══════════════════════════════════════════════════════════════');

    // Step 1: Init
    const initOk = await handleInit();
    if (!initOk) {
      addLog('error', 'Deployment stopped due to init failure.');
      return;
    }

    // Step 2: Validate
    const validateOk = await handleValidate();
    if (!validateOk) {
      addLog('error', 'Deployment stopped due to validation failure.');
      return;
    }

    // Step 3: Plan
    const planResult = await handlePlan();
    if (!planResult || !planResult.success) {
      addLog('error', 'Deployment stopped due to plan generation failure.');
      return;
    }

    // Modal will automatically open and pause workflow waiting for user approval
  };

  const handleFetchOutputs = async () => {
    addLog('command', '$ terraform output -json');
    try {
      const res = await getTerraformOutputs();
      if (res.success && res.outputs) {
        setLatestOutputs(res.outputs);
        addLog('success', '✓ Fetched current Terraform infrastructure outputs.');
      } else {
        addLog('warning', 'No outputs returned or terraform output returned empty.');
      }
    } catch (err: any) {
      addLog('error', `Failed to fetch outputs: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200/60 text-indigo-600">
                <Server className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Infrastructure Deployment
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Manage AWS serverless infrastructure using backend-controlled Terraform execution.
              Includes single-click deployment, plan safety approval, and live terminal telemetry.
            </p>
          </div>

          {/* Status Indicator Badge */}
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border">
              {step === 'idle' && (
                <span className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>● Ready</span>
                </span>
              )}
              {step === 'initializing' && (
                <span className="flex items-center space-x-1.5 text-sky-700 bg-sky-50 border-sky-200">
                  <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
                  <span>● Initializing</span>
                </span>
              )}
              {step === 'validating' && (
                <span className="flex items-center space-x-1.5 text-sky-700 bg-sky-50 border-sky-200">
                  <Loader2 className="h-3 w-3 animate-spin text-sky-600" />
                  <span>● Validating</span>
                </span>
              )}
              {step === 'planning' && (
                <span className="flex items-center space-x-1.5 text-amber-700 bg-amber-50 border-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                  <span>● Planning</span>
                </span>
              )}
              {step === 'waiting_approval' && (
                <span className="flex items-center space-x-1.5 text-amber-800 bg-amber-100 border-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>● Waiting for Approval</span>
                </span>
              )}
              {step === 'applying' && (
                <span className="flex items-center space-x-1.5 text-purple-700 bg-purple-50 border-purple-200">
                  <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
                  <span>● Applying</span>
                </span>
              )}
              {step === 'destroying' && (
                <span className="flex items-center space-x-1.5 text-rose-700 bg-rose-50 border-rose-200">
                  <Loader2 className="h-3 w-3 animate-spin text-rose-600" />
                  <span>● Destroying...</span>
                </span>
              )}
              {step === 'success' && (
                <span className="flex items-center space-x-1.5 text-emerald-700 bg-emerald-50 border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>✓ Deployment Successful</span>
                </span>
              )}
              {step === 'failed' && (
                <span className="flex items-center space-x-1.5 text-rose-700 bg-rose-50 border-rose-200">
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  <span>✕ Deployment Failed</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Primary Action Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDeployWorkflow}
              disabled={isBusy}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all ${
                isBusy
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50 hover:shadow-md active:scale-98'
              }`}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-white" />
              )}
              <span>Deploy Infrastructure</span>
            </button>
            <span className="text-xs text-slate-400 hidden sm:inline">
              (Automates: init → validate → plan → approval → apply)
            </span>
          </div>

          {/* Granular Step Buttons & Explicit Destroy */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleInit}
              disabled={isBusy}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Initialize
            </button>
            <button
              onClick={handleValidate}
              disabled={isBusy}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Validate
            </button>
            <button
              onClick={handlePlan}
              disabled={isBusy}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Plan
            </button>
            <button
              onClick={() => {
                if (activePlan) {
                  setShowApprovalModal(true);
                } else {
                  handleApply();
                }
              }}
              disabled={isBusy}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleFetchOutputs}
              disabled={isBusy}
              title="Refresh outputs"
              className="p-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {/* Explicit Destroy Button (Differentiated Styling) */}
            <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
            <button
              onClick={() => setShowDestroyModal(true)}
              disabled={isBusy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 disabled:opacity-50 transition-colors shadow-2xs"
              title="Explicit Terraform Destroy (Requires Confirmation)"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Destroy Infrastructure</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal-Style Output Console */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-xl overflow-hidden font-mono text-xs">
        {/* Terminal Header Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between select-none">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-slate-400 text-[11px] font-medium ml-2 flex items-center space-x-1">
              <Terminal className="h-3.5 w-3.5 text-slate-400" />
              <span>Terraform Console</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">infrastructure/environments/dev</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={clearTerminal}
              className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
              title="Clear terminal log"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalContainerRef}
          onScroll={handleScroll}
          className="p-4 h-96 overflow-y-auto space-y-1.5 leading-relaxed text-slate-300 font-mono select-text"
        >
          {logs.map((log) => {
            if (log.type === 'command') {
              return (
                <div key={log.id} className="pt-2 text-cyan-400 font-bold flex items-start space-x-2">
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span>{log.text}</span>
                </div>
              );
            }
            if (log.type === 'success') {
              return (
                <div key={log.id} className="text-emerald-400 font-medium flex items-start space-x-2">
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span>{log.text}</span>
                </div>
              );
            }
            if (log.type === 'error') {
              return (
                <div key={log.id} className="text-rose-400 font-semibold flex items-start space-x-2 bg-rose-950/20 p-1 rounded">
                  <span className="text-rose-600 select-none">{log.timestamp}</span>
                  <span className="whitespace-pre-wrap break-all">{log.text}</span>
                </div>
              );
            }
            if (log.type === 'warning') {
              return (
                <div key={log.id} className="text-amber-400 flex items-start space-x-2">
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span>{log.text}</span>
                </div>
              );
            }
            if (log.type === 'info') {
              return (
                <div key={log.id} className="text-indigo-300/80 italic flex items-start space-x-2">
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span>{log.text}</span>
                </div>
              );
            }
            return (
              <div key={log.id} className="text-slate-300 whitespace-pre-wrap break-words flex items-start space-x-2">
                <span className="text-slate-600 select-none text-[10px]">{log.timestamp}</span>
                <span className="flex-1">{log.text}</span>
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Outputs & Live Resources Section */}
      {latestOutputs && Object.keys(latestOutputs).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Active AWS Infrastructure Outputs
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">Region: ap-south-1</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* API Endpoint */}
            {latestOutputs.api_endpoint && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  HTTP API Gateway Endpoint
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-800 truncate text-[11px]">
                    {latestOutputs.api_endpoint}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => copyToClipboard(latestOutputs.api_endpoint, 'api')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Copy URL"
                    >
                      {copiedKey === 'api' ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={latestOutputs.api_endpoint}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* DynamoDB Table */}
            {latestOutputs.jobs_table_name && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  DynamoDB Jobs Table
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-800 truncate text-[11px]">
                    {latestOutputs.jobs_table_name}
                  </span>
                  <button
                    onClick={() => copyToClipboard(latestOutputs.jobs_table_name, 'ddb')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    title="Copy table name"
                  >
                    {copiedKey === 'ddb' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* SQS Queue */}
            {latestOutputs.sqs_queue_url && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Amazon SQS Primary Queue
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-800 truncate text-[11px]">
                    {latestOutputs.sqs_queue_url}
                  </span>
                  <button
                    onClick={() => copyToClipboard(latestOutputs.sqs_queue_url, 'sqs')}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600"
                    title="Copy SQS URL"
                  >
                    {copiedKey === 'sqs' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* S3 Artifacts Bucket */}
            {latestOutputs.s3_bucket_name && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  S3 Artifacts Bucket
                </span>
                <span className="font-mono text-slate-800 truncate text-[11px] block">
                  {latestOutputs.s3_bucket_name}
                </span>
              </div>
            )}

            {/* Producer Lambda ARN */}
            {latestOutputs.producer_lambda_arn && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Producer Lambda ARN
                </span>
                <span className="font-mono text-slate-800 truncate text-[11px] block">
                  {latestOutputs.producer_lambda_arn}
                </span>
              </div>
            )}

            {/* Worker Lambda ARN */}
            {latestOutputs.worker_lambda_arn && (
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Worker Lambda ARN
                </span>
                <span className="font-mono text-slate-800 truncate text-[11px] block">
                  {latestOutputs.worker_lambda_arn}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security & Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start space-x-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-slate-900">Zero Frontend Credentials</h4>
            <p className="text-slate-500 mt-0.5 leading-normal">
              Terraform executes strictly inside the backend Node.js process using native AWS IAM
              and environment credentials. No access keys, secret keys, or `.tfstate` files are
              transmitted over HTTP.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-start space-x-3">
          <Layers className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-slate-900">Synchronized State & Locking</h4>
            <p className="text-slate-500 mt-0.5 leading-normal">
              In-memory backend mutex prevents multiple concurrent operations against the same
              working directory. All apply commands require explicit user authorization.
            </p>
          </div>
        </div>
      </div>

      {/* Plan Approval Modal */}
      <AnimatePresence>
        {showApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Terraform Plan Ready
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confirmation required before modifying live AWS cloud resources.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <p className="font-medium text-slate-700">
                  Terraform wants to make the following infrastructure changes:
                </p>

                {activePlan?.details ? (
                  <div className="p-3 bg-white rounded-lg border border-slate-200/80 font-mono text-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700 font-semibold">+ To Add:</span>
                      <span className="font-bold">{activePlan.details.add}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-700 font-semibold">~ To Change:</span>
                      <span className="font-bold">{activePlan.details.change}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-rose-700 font-semibold">- To Destroy:</span>
                      <span className="font-bold">{activePlan.details.destroy}</span>
                    </div>
                    {activePlan.details.noChanges && (
                      <div className="text-xs text-slate-500 pt-1 text-center font-sans">
                        ✓ Infrastructure already matches configuration.
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="font-mono text-slate-800 p-2 bg-white rounded border">
                    {activePlan?.summary || 'Plan generated successfully.'}
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  Clicking <strong>YES, APPLY</strong> will execute{' '}
                  <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">
                    terraform apply -auto-approve
                  </code>
                  .
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelApply}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 transition-all active:scale-98"
                >
                  YES, APPLY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Explicit Destroy Confirmation Modal */}
      <AnimatePresence>
        {showDestroyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-200 text-rose-600">
                  <AlertTriangle className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Destroy AWS Infrastructure?
                  </h3>
                  <p className="text-xs text-rose-600 font-medium">
                    Warning: This action is destructive and irreversible.
                  </p>
                </div>
              </div>

              <div className="bg-rose-50/60 rounded-xl p-4 border border-rose-200 text-xs space-y-3">
                <p className="text-slate-700 leading-relaxed font-medium">
                  This will execute{' '}
                  <code className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-mono font-bold">
                    terraform destroy -auto-approve
                  </code>{' '}
                  against your AWS environment (<span className="font-semibold">ap-south-1</span>).
                </p>

                <p className="text-slate-600">The following cloud resources will be completely torn down:</p>
                <ul className="list-disc list-inside text-slate-700 space-y-1 font-mono text-[11px] bg-white p-3 rounded-lg border border-rose-100">
                  <li>DynamoDB Table: JobsTable</li>
                  <li>Amazon SQS: Primary Queue & DLQ</li>
                  <li>AWS Lambda: Producer & Worker Functions</li>
                  <li>Amazon API Gateway: HTTP API & Stage</li>
                  <li>Amazon S3: Artifacts Bucket</li>
                </ul>

                <p className="text-[11px] text-slate-500 font-medium">
                  Are you sure you want to permanently destroy this infrastructure?
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDestroyModal(false);
                    addLog('info', 'Destruction cancelled by user. Terraform destroy was NOT executed.');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleDestroy}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-200 transition-all active:scale-98 flex items-center space-x-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>YES, DESTROY INFRASTRUCTURE</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
