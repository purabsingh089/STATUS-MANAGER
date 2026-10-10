export interface ScheduledTask {
  id: string;
  label: string;
  intervalMs: number;
  fn: () => Promise<void>;
}

export class Scheduler {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private tasks: ScheduledTask[] = [];
  private running = false;

  register(task: ScheduledTask): void {
    this.tasks = this.tasks.filter((t) => t.id !== task.id);
    this.tasks.push(task);
    if (this.running) this.startTask(task);
  }

  start(): void {
    this.running = true;
    for (const task of this.tasks) this.startTask(task);
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }

  list(): { id: string; label: string; intervalMs: number; active: boolean }[] {
    return this.tasks.map((t) => ({
      id: t.id,
      label: t.label,
      intervalMs: t.intervalMs,
      active: this.timers.has(t.id),
    }));
  }

  private startTask(task: ScheduledTask): void {
    const existing = this.timers.get(task.id);
    if (existing) clearInterval(existing);
    const timer = setInterval(() => {
      void task.fn();
    }, task.intervalMs);
    this.timers.set(task.id, timer);
  }
}
