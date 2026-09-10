export interface EventLogEntry {
  id: string;
  timestamp: string;
  timeFormatted: string;
  category: 'BATCH' | 'SQS' | 'LAMBDA' | 'DYNAMODB' | 'SYSTEM';
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  batchId?: string;
  metadata?: Record<string, any>;
}

export class EventLogService {
  private logs: EventLogEntry[] = [];
  private maxLogs = 500;

  public log(
    category: EventLogEntry['category'],
    message: string,
    level: EventLogEntry['level'] = 'INFO',
    batchId?: string,
    metadata?: Record<string, any>
  ): EventLogEntry {
    const now = new Date();
    const entry: EventLogEntry = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      timeFormatted: now.toTimeString().split(' ')[0],
      category,
      level,
      message,
      batchId,
      metadata,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    console.log(`[${entry.timeFormatted}] [${category}] ${message}`);
    return entry;
  }

  public getLogs(batchId?: string, limit = 100): EventLogEntry[] {
    if (batchId) {
      return this.logs.filter((l) => l.batchId === batchId).slice(0, limit);
    }
    return this.logs.slice(0, limit);
  }

  public clear(): void {
    this.logs = [];
  }
}

export const globalEventLogService = new EventLogService();
