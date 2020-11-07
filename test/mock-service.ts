import { IProcessManagerService, IServiceHealth } from '..';
import { HealthState } from '../src/IServiceHealth';
import IServiceStatus, { RunState } from '../src/IServiceStatus';

export default class MockService implements IProcessManagerService {
  private name: string;
  private health: HealthState;
  private state: RunState;
  private statusMessage?: string;
  private healthMessage?: string;

  constructor(name: string) {
    this.name = name;
    this.health = 'healthy';
    this.state = 'stopped';
  }

  getName(): string {
    return this.name;
  }
  getHealth(): Promise<IServiceHealth> {
    return Promise.resolve({
      healthy: this.health,
      ...(this.healthMessage && { message: this.healthMessage }),
    });
  }
  getStatus(): IServiceStatus {
    return {
      state: this.state,
      ...(this.statusMessage && { message: this.statusMessage }),
    };
  }

  start(): Promise<void> {
    this.state = 'starting';
    return Promise.resolve();
  }
  stop(): Promise<void> {
    this.state = 'stopping';
    return Promise.resolve();
  }

  mockHealth(health: HealthState, message?: string) {
    this.health = health;
    this.healthMessage = message;
  }
  mockNext(errorMessage?: string) {
    if (errorMessage) {
      this.state = 'errored';
      this.statusMessage = errorMessage;
      return;
    }
    switch (this.state) {
      case 'starting':
        this.state = 'running';
        return;
      case 'stopping':
        this.state = 'stopped';
        return;
      default:
        return;
    }
  }
}
