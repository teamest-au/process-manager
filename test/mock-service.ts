import { IProcessManagerService, IServiceHealth } from '..';

export default class MockService implements IProcessManagerService {
  private name: string;
  private healthy: boolean;

  private pendingStarts: { res: () => void; rej: (error: Object) => void }[];
  private pendingStops: { res: () => void; rej: (error: Object) => void }[];

  constructor(name: string) {
    this.name = name;
    this.healthy = true;
    this.pendingStarts = [];
    this.pendingStops = [];
  }
  getName(): string {
    return this.name;
  }
  getHealth(): Promise<IServiceHealth> {
    return Promise.resolve({
      healthy: this.healthy,
    });
  }
  start(): Promise<void> {
    return new Promise((res, rej) => {
      this.pendingStarts.push({ res, rej });
    });
  }
  stop(): Promise<void> {
    return new Promise((res, rej) => {
      this.pendingStops.push({ res, rej });
    });
  }

  mockHealth(healthy: boolean) {
    this.healthy = healthy;
  }
  mockStarted(error?: Object) {
    if (error) {
      this.pendingStarts.forEach(({ rej }) => rej(error));
    } else {
      this.pendingStarts.forEach(({ res }) => res());
    }
    this.pendingStarts = [];
  }
  mockStopped(error?: Object) {
    if (error) {
      this.pendingStops.forEach(({ rej }) => rej(error));
    } else {
      this.pendingStops.forEach(({ res }) => res());
    }
    this.pendingStops = [];
  }
}
