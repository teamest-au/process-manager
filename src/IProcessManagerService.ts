import IServiceHealth from "./IServiceHealth";

export default interface IProcessManagerService {
  getName(): string;
  getHealth(): Promise<IServiceHealth>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
