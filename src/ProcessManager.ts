import Koa from 'koa';

import ILogger from './ILogger';
import IProcessManagerOptions from './IProcessManagerOptions';
import IProcessManagerService from './IProcessManagerService';
import IProcessStatus, { combineServiceStates } from './IProcessStatus';
import IProcessHealth, { combineServiceHealths } from './IProcessHealth';
import IServiceStatus, { RunState } from './IServiceStatus';
import { IServiceHealth } from '..';

function timeoutResolve<T>(ms: number, result: T): Promise<T> {
  return new Promise((res) => {
    setTimeout(() => res(result), ms);
  });
}

export default class ProcessManager {
  private logger: ILogger;
  private options: IProcessManagerOptions;
  private targetState: 'running' | 'stopped';
  private healthRunning: boolean = false;

  private services: {
    [key: string]: IProcessManagerService;
  };

  constructor(logger: ILogger, options: IProcessManagerOptions) {
    this.logger = logger;
    this.options = options;
    this.services = {};
    this.targetState = 'stopped';

    this.startService.bind(this);
    this.stopService.bind(this);
    this.registerService.bind(this);
    this.getStatus.bind(this);
    this.start.bind(this);
    this.stop.bind(this);

    process.on('SIGTERM', () => {
      this.logger.info('SIGTERM - Initiating shutdown');
      this.stop();
    });
    process.on('uncaughtException', (err) => {
      this.logger.error(`Application uncaughtException`, err);
      this.stop();
    });
    process.on('unhandledRejection', (err) => {
      this.logger.error(`Application unhandledRejection`, err);
    });
    process.on('warning', (err) => {
      this.logger.warn('Application warning', err);
    });
  }

  private async startService(name: string): Promise<void> {
    this.logger.debug(`Attempting to start service [${name}]`);
    const service = this.services[name];
    if (!service) {
      throw new Error(
        `Cannot start service [${name}]: no service registered with that name`,
      );
    }

    const currentState = await service.getStatus();
    if (currentState.state === 'starting' || currentState.state === 'running') {
      this.logger.warn(
        `Attempted to start service [${name}] already in the [${currentState.state}] state`,
      );
      return;
    }

    service.start();
  }

  private async stopService(name: string) {
    this.logger.debug(`Attempting to stop service [${name}]`);
    const service = this.services[name];
    if (!service) {
      throw new Error(
        `Cannot stop service [${name}]: no service registered with that name`,
      );
    }

    const currentState = await service.getStatus();
    if (
      currentState.state === 'stopping' ||
      currentState.state === 'stopped' ||
      currentState.state === 'errored'
    ) {
      this.logger.warn(
        `Attempted to stop service [${name}] already in the [${currentState.state}] state`,
      );
      return;
    }
    service.stop();
  }

  registerService(service: IProcessManagerService) {
    const name = service.getName();

    if (this.services[name] !== undefined) {
      throw new Error(`Service with name [${name}] already registered`);
    }

    this.logger.debug(`Registered service: ${name}`);

    this.services[name] = service;
    if (this.targetState === 'running') {
      this.startService(name);
    }
  }

  getStatus(): IProcessStatus {
    const serviceResults = Object.entries(this.services).map(
      ([name, service]) => {
        const serviceStatus = service.getStatus();
        return { name, serviceStatus };
      },
    );

    const services: { [key: string]: IServiceStatus } = serviceResults.reduce(
      (acc, res) => {
        return {
          ...acc,
          [res.name]: res.serviceStatus,
        };
      },
      {},
    );

    return {
      state:
        Object.values(services).length === 0
          ? this.targetState
          : combineServiceStates(Object.values(services).map((s) => s.state)),
      services,
    };
  }

  async getHealth(): Promise<IProcessHealth> {
    const serviceResults = await Promise.all(
      Object.entries(this.services).map(async ([name, service]) => {
        const serviceHealth = await Promise.race([
          timeoutResolve(this.options.healthResponseTimeMs, {
            healthy: false,
            message: 'timeout waiting to evaluate health',
          }),
          service.getHealth(),
        ]);
        return {
          name,
          serviceHealth,
        };
      }),
    );

    const services: { [key: string]: IServiceHealth } = serviceResults.reduce(
      (acc, res) => {
        return {
          ...acc,
          [res.name]: res.serviceHealth,
        };
      },
      {},
    );

    return {
      healthy:
        Object.values(services).length === 0
          ? 'healthy'
          : combineServiceHealths(
              Object.values(services).map((s) => s.healthy),
            ),
      services,
    };
  }

  start() {
    if (!this.healthRunning) {
      this.healthRunning = true;
      const health = new Koa();

      health.use(async (ctx, next) => {
        switch (ctx.request.path) {
          case '/healthz':
            const health = await this.getHealth();
            if (health.healthy !== 'unhealthy') {
              ctx.response.status = 200;
            } else {
              ctx.response.status = 503;
            }
            ctx.response.body = health;
            break;
          case '/readyz':
            const status = this.getStatus();
            if (status.state === 'running') {
              ctx.response.status = 200;
            } else {
              ctx.response.status = 503;
            }
            ctx.response.body = status;
            break;
          default:
            ctx.response.status = 404;
            ctx.response.body = 'Usage: GET /healthz /readyz';
            break;
        }
        next();
      });

      health.listen(this.options.healthPort);
      this.logger.info(
        `Health check listening on port ${this.options.healthPort}`,
      );
    }

    this.targetState = 'running';
    for (const service in this.services) {
      this.startService(service);
    }
  }

  stop() {
    this.targetState = 'stopped';
    for (const service in this.services) {
      this.stopService(service);
    }
  }
}
