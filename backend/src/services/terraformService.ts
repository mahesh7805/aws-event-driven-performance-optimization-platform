import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface PlanDetails {
  add: number;
  change: number;
  destroy: number;
  noChanges: boolean;
  summaryText: string;
}

export interface TerraformCommandResult {
  command: string;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  summary?: string;
  planDetails?: PlanDetails;
  outputs?: Record<string, any>;
  timestamp: string;
}

export interface TerraformStatus {
  isBusy: boolean;
  currentOperation: string | null;
  terraformDir: string;
  lastRun?: {
    command: string;
    success: boolean;
    timestamp: string;
    durationMs: number;
  };
}

export class TerraformService {
  private isBusy = false;
  private currentOperation: string | null = null;
  private terraformDir: string;
  private lastRun?: {
    command: string;
    success: boolean;
    timestamp: string;
    durationMs: number;
  };

  constructor(customDir?: string) {
    this.terraformDir = customDir || this.resolveTerraformDirectory();
  }

  private resolveTerraformDirectory(): string {
    if (process.env.TERRAFORM_DIR && fs.existsSync(process.env.TERRAFORM_DIR)) {
      return path.resolve(process.env.TERRAFORM_DIR);
    }

    const cwdCandidates = [
      path.resolve(process.cwd(), 'infrastructure/environments/dev'),
      path.resolve(process.cwd(), '../infrastructure/environments/dev'),
      path.resolve(process.cwd(), '../../infrastructure/environments/dev'),
    ];

    for (const candidate of cwdCandidates) {
      if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'main.tf'))) {
        return candidate;
      }
    }

    try {
      const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
      const upCandidates = [
        path.resolve(currentDir, '../../../infrastructure/environments/dev'),
        path.resolve(currentDir, '../../infrastructure/environments/dev'),
        path.resolve(currentDir, '../infrastructure/environments/dev'),
      ];

      for (const candidate of upCandidates) {
        if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'main.tf'))) {
          return candidate;
        }
      }
    } catch {
      // Fallback
    }

    return path.resolve(process.cwd(), 'infrastructure/environments/dev');
  }

  public getStatus(): TerraformStatus {
    return {
      isBusy: this.isBusy,
      currentOperation: this.currentOperation,
      terraformDir: this.terraformDir,
      lastRun: this.lastRun,
    };
  }

  public parsePlanSummary(output: string): PlanDetails | undefined {
    const planMatch = output.match(/Plan:\s*(\d+)\s*to add,\s*(\d+)\s*to change,\s*(\d+)\s*to destroy/i);
    if (planMatch) {
      const add = parseInt(planMatch[1], 10);
      const change = parseInt(planMatch[2], 10);
      const destroy = parseInt(planMatch[3], 10);
      return {
        add,
        change,
        destroy,
        noChanges: add === 0 && change === 0 && destroy === 0,
        summaryText: `Plan: ${add} to add, ${change} to change, ${destroy} to destroy`,
      };
    }

    if (/No changes\.\s*(Your infrastructure matches the configuration|Infrastructure matches the configuration)/i.test(output)) {
      return {
        add: 0,
        change: 0,
        destroy: 0,
        noChanges: true,
        summaryText: 'Plan: 0 to add, 0 to change, 0 to destroy (No changes detected)',
      };
    }

    return undefined;
  }

  private async executeCommand(commandName: string, args: string[]): Promise<TerraformCommandResult> {
    if (this.isBusy) {
      throw new Error(`Another Terraform operation (${this.currentOperation}) is currently in progress.`);
    }

    this.isBusy = true;
    this.currentOperation = commandName;
    const startTime = Date.now();
    const fullCommand = `terraform ${args.join(' ')}`;

    console.log(`[Terraform] Starting ${commandName}...`);

    return new Promise<TerraformCommandResult>((resolve) => {
      let stdout = '';
      let stderr = '';

      let child;
      try {
        child = spawn('terraform', args, {
          cwd: this.terraformDir,
          shell: false,
          env: { ...process.env, TF_IN_AUTOMATION: '1' },
        });
      } catch (err: any) {
        this.isBusy = false;
        this.currentOperation = null;
        console.error(`[Terraform ERROR] Failed to spawn process: ${err.message}`);
        resolve({
          command: fullCommand,
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: err.message || 'Failed to spawn terraform process',
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        stderr += `\nProcess error: ${err.message}`;
      });

      child.on('close', (code) => {
        const durationMs = Date.now() - startTime;
        const success = code === 0;

        this.isBusy = false;
        this.currentOperation = null;
        this.lastRun = {
          command: commandName,
          success,
          timestamp: new Date().toISOString(),
          durationMs,
        };

        if (success) {
          console.log(`[Terraform] ${commandName.charAt(0).toUpperCase() + commandName.slice(1)} completed successfully (${durationMs}ms).`);
        } else {
          console.error(`[Terraform ERROR] ${commandName} failed with exit code ${code} (${durationMs}ms):`);
          console.error(stderr || stdout);
        }

        let planDetails: PlanDetails | undefined;
        let summary: string | undefined;

        if (commandName === 'plan' && success) {
          planDetails = this.parsePlanSummary(stdout);
          summary = planDetails?.summaryText;
        } else if (commandName === 'apply' && success) {
          summary = 'Apply complete! Resources successfully provisioned.';
        } else if (commandName === 'destroy' && success) {
          summary = 'Destroy complete! All infrastructure resources have been torn down.';
        } else if (commandName === 'validate' && success) {
          summary = 'Success! The configuration is valid.';
        } else if (commandName === 'init' && success) {
          summary = 'Terraform has been successfully initialized!';
        }

        resolve({
          command: fullCommand,
          success,
          exitCode: code,
          stdout,
          stderr,
          durationMs,
          summary,
          planDetails,
          timestamp: new Date().toISOString(),
        });
      });
    });
  }

  public async init(): Promise<TerraformCommandResult> {
    return this.executeCommand('init', ['init', '-no-color']);
  }

  public async validate(): Promise<TerraformCommandResult> {
    return this.executeCommand('validate', ['validate', '-no-color']);
  }

  public async plan(): Promise<TerraformCommandResult> {
    return this.executeCommand('plan', ['plan', '-no-color']);
  }

  public async apply(): Promise<TerraformCommandResult> {
    const result = await this.executeCommand('apply', ['apply', '-auto-approve', '-no-color']);
    if (result.success) {
      try {
        const outputs = await this.getOutputsRaw();
        result.outputs = outputs;
      } catch {
        // Output retrieval failure is non-fatal to apply result
      }
    }
    return result;
  }

  public async destroy(): Promise<TerraformCommandResult> {
    const result = await this.executeCommand('destroy', ['destroy', '-auto-approve', '-no-color']);
    if (result.success) {
      result.outputs = {};
    }
    return result;
  }

  public async getOutputs(): Promise<TerraformCommandResult> {
    const result = await this.executeCommand('output', ['output', '-json']);
    if (result.success && result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout);
        const simplified: Record<string, any> = {};
        for (const [key, val] of Object.entries(parsed)) {
          simplified[key] = (val as any).value ?? val;
        }
        result.outputs = simplified;
      } catch (err: any) {
        console.error('[Terraform ERROR] Failed to parse terraform output JSON:', err);
      }
    }
    return result;
  }

  private async getOutputsRaw(): Promise<Record<string, any>> {
    return new Promise((resolve) => {
      const child = spawn('terraform', ['output', '-json'], {
        cwd: this.terraformDir,
        shell: false,
      });

      let stdout = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const parsed = JSON.parse(stdout);
            const simplified: Record<string, any> = {};
            for (const [key, val] of Object.entries(parsed)) {
              simplified[key] = (val as any).value ?? val;
            }
            resolve(simplified);
            return;
          } catch {
            // Ignore parse errors
          }
        }
        resolve({});
      });
    });
  }
}

export const globalTerraformService = new TerraformService();
