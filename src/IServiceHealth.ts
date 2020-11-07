export type HealthState = 'healthy' | 'degraded' | 'unhealthy';

export default interface IServiceHealth {
  healthy: HealthState;
  message?: string;
}
