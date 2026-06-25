/**
 * Engine process entry point.
 * Will host scanning, scheduling, and reporting services.
 * Currently a skeleton for Phase 0.
 */
export class Engine {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[Engine] started");
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log("[Engine] stopped");
  }

  isRunning(): boolean {
    return this.running;
  }
}
