export interface IProcessHealth {
  healthy: boolean;
  message?: string;
}

export default interface IProcessManagerService {
  getName(): string;
  getHealth(): Promise<IProcessHealth>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
