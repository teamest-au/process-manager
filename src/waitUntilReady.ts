import IProcessManagerService from './IProcessManagerService';

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function serviceReady(
  service: IProcessManagerService,
  requiredHealth?: 'healthy' | 'degraded',
): Promise<boolean> {
  if (!(service.getStatus().state === 'running')) {
    return false;
  }
  if (requiredHealth) {
    const health = await service.getHealth();
    switch (health.healthy) {
      case 'healthy':
        return true;
      case 'degraded':
        return requiredHealth === 'degraded';
      default:
        return false;
    }
  }
  return true;
}

export default async function waitUntilReady(
  services: IProcessManagerService[],
  sleepDurationMs: number,
  requiredHealth?: 'healthy' | 'degraded',
) {
  let ready = false;
  while (!ready) {
    const results = await Promise.all(
      services.map((s) => serviceReady(s, requiredHealth)),
    );
    ready = results.every((r) => r);
    if (!ready) {
      await sleep(sleepDurationMs);
    }
  }
}
