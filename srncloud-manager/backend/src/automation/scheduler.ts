import { getSettings, setSetting } from '../db/repositories.js';
import { logger } from '../shared/logger.js';

type TaskCallback = () => Promise<void>;

interface ScheduledTask {
  name: string;
  intervalMs: number;
  callback: TaskCallback;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: string | null;
  enabled: boolean;
}

/**
 * Automation Scheduler — runs periodic health-check and sync tasks.
 *
 * This does NOT use randomized human-like timing; it uses clean fixed intervals
 * that the user configures. Intervals are read from the settings table.
 */
export class AutomationScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private running = false;

  private getInterval(key: string, defaultSec: number): number {
    const val = getSettings()[key];
    if (!val) return defaultSec * 1000;
    const parsed = parseInt(val, 10);
    return (isNaN(parsed) || parsed < 5 ? defaultSec : parsed) * 1000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.setupTasks();
    logger.info('Automation scheduler started');
  }

  stop(): void {
    for (const [, task] of this.tasks) {
      if (task.timer) {
        clearInterval(task.timer);
        task.timer = null;
      }
    }
    this.tasks.clear();
    this.running = false;
    logger.info('Automation scheduler stopped');
  }

  private setupTasks(): void {
    const sessionCheck = this.getInterval('health_check_interval', 60);
    const serverStatus = this.getInterval('server_status_interval', 30);
    const accountSync = this.getInterval('account_sync_interval', 300);

    // Session check
    this.register('session_check', sessionCheck, async () => {
      logger.debug('Scheduled task: session check');
      // Will be wired to the SessionMonitor
    });

    // Server status sync
    this.register('server_status', serverStatus, async () => {
      logger.debug('Scheduled task: server status sync');
    });

    // Account sync
    this.register('account_sync', accountSync, async () => {
      logger.debug('Scheduled task: account sync');
    });

    // Daily report
    this.register('daily_report', 86400000, async () => {
      logger.debug('Scheduled task: daily report');
    });
  }

  private register(name: string, intervalMs: number, callback: TaskCallback): void {
    const task: ScheduledTask = {
      name,
      intervalMs,
      callback,
      timer: null,
      lastRun: null,
      enabled: true,
    };
    this.tasks.set(name, task);
    task.timer = setInterval(async () => {
      try {
        await callback();
        task.lastRun = new Date().toISOString();
      } catch (err) {
        logger.warn(`Scheduled task ${name} failed`, { error: String(err) });
      }
    }, intervalMs);
  }

  /** Update interval for a named task (e.g., from settings change). */
  updateTaskInterval(name: string, intervalSec: number): void {
    const task = this.tasks.get(name);
    if (!task || !task.timer) return;
    clearInterval(task.timer);
    task.intervalMs = intervalSec * 1000;
    task.timer = setInterval(async () => {
      try {
        await task.callback();
        task.lastRun = new Date().toISOString();
      } catch (err) {
        logger.warn(`Scheduled task ${name} failed`, { error: String(err) });
      }
    }, task.intervalMs);
  }

  getTaskStatus(): { name: string; intervalMs: number; lastRun: string | null; enabled: boolean }[] {
    return [...this.tasks.values()].map(t => ({
      name: t.name,
      intervalMs: t.intervalMs,
      lastRun: t.lastRun,
      enabled: t.enabled,
    }));
  }
}
