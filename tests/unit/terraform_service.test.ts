import { describe, it, expect } from 'vitest';
import { TerraformService } from '../../backend/src/services/terraformService.js';
import path from 'path';

describe('TerraformService Unit Tests', () => {
  const service = new TerraformService();

  it('should initialize and resolve terraform directory', () => {
    const status = service.getStatus();
    expect(status.isBusy).toBe(false);
    expect(status.currentOperation).toBeNull();
    expect(status.terraformDir).toContain(path.join('infrastructure', 'environments', 'dev'));
  });

  it('should parse plan output with additions, changes, and destructions', () => {
    const output = `
Terraform will perform the following actions:

  # aws_dynamodb_table.jobs will be created
  + resource "aws_dynamodb_table" "jobs" {
      + arn              = (known after apply)
    }

Plan: 3 to add, 1 to change, 0 to destroy.
`;
    const details = service.parsePlanSummary(output);
    expect(details).toBeDefined();
    expect(details?.add).toBe(3);
    expect(details?.change).toBe(1);
    expect(details?.destroy).toBe(0);
    expect(details?.noChanges).toBe(false);
    expect(details?.summaryText).toBe('Plan: 3 to add, 1 to change, 0 to destroy');
  });

  it('should parse plan output when no changes are needed', () => {
    const output = 'No changes. Your infrastructure matches the configuration.';
    const details = service.parsePlanSummary(output);
    expect(details).toBeDefined();
    expect(details?.add).toBe(0);
    expect(details?.change).toBe(0);
    expect(details?.destroy).toBe(0);
    expect(details?.noChanges).toBe(true);
  });

  it('should execute terraform validate against infrastructure/environments/dev', async () => {
    const result = await service.validate();
    expect(result.command).toBe('terraform validate -no-color');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Success! The configuration is valid.');
    expect(result.durationMs).toBeGreaterThan(0);

    const statusAfter = service.getStatus();
    expect(statusAfter.isBusy).toBe(false);
    expect(statusAfter.lastRun?.command).toBe('validate');
    expect(statusAfter.lastRun?.success).toBe(true);
  });

  it('should prevent simultaneous operations when a command is in progress', async () => {
    const busyService = new TerraformService();
    // Simulate active operation
    (busyService as any).isBusy = true;
    (busyService as any).currentOperation = 'plan';

    await expect(busyService.init()).rejects.toThrow(/Another Terraform operation \(plan\) is currently in progress/);
    await expect(busyService.destroy()).rejects.toThrow(/Another Terraform operation \(plan\) is currently in progress/);
  });
});
