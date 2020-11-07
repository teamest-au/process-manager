import IServiceHealth from './IServiceHealth';
import IServiceStatus from './IServiceStatus';

export default interface IProcessManagerService {
  getName(): string;
  getHealth(): Promise<IServiceHealth>;
  getStatus(): IServiceStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
}
