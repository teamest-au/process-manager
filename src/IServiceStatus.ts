export type RunState = 'stopped' | 'starting' | 'running' | 'stopping' | 'errored';

export default interface IServiceStatus {
  state: RunState;
  message?: string;
}
