import IServiceHealth, { HealthState } from './IServiceHealth';

export function combineServiceHealths(healths: HealthState[]): HealthState {
  if(healths.every(h => h ==='healthy')) {
    return 'healthy';
  } else if(healths.some(h => h === 'unhealthy')) {
    return 'unhealthy';
  } else {
    return 'degraded';
  }
}

export default interface IProcessHealth {
  healthy: HealthState;
  services: {
    [key: string]: IServiceHealth;
  };
}
