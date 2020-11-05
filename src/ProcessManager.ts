import Koa from 'koa';

import ILogger from './ILogger';
import IProcessManagerOptions from './IProcessManagerOptions';
import RunState from './RunState';
import IProcessManagerService from './IProcessManagerService';
import IProcessStatus from './IProcessStatus';
import IProcessHealth from './IProcessHealth';
import { Server } from 'http';
import { throws } from 'assert';

function timeoutResolve<T>(ms: number, result: T): Promise<T> {
  return new Promise((res) => {
    setTimeout(() => res(result), ms);
  });
}

export default class ProcessManager {
  private logger: ILogger;
  private options: IProcessManagerOptions;
  private currentState: RunState;
  private exitListeners: (() => void)[];
  private healthServer?: Server;

  private services: {
    [key: string]: {
      service: IProcessManagerService;
      state: RunState;
      error?: any;
    };
  };

  constructor(logger: ILogger, options: IProcessManagerOptions) {
    this.logger = logger;
    this.options = options;
    this.services = {};
    this.currentState = 'stopped';
    this.exitListeners = [];

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

  private startService(name: string) {
    this.logger.debug(`Attempting to start service [${name}]`);
    const entry = this.services[name];
    if (!entry) {
      throw new Error(
        `Cannot start service [${name}]: no service registered with that name`,
      );
    }
    if (entry.state === 'starting' || entry.state === 'running') {
      this.logger.warn(
        `Attempted to start service [${name}] already in the [${entry.state}] state`,
      );
      return;
    }
    entry.state = 'starting';
    entry.service
      .start()
      .then(() => {
        this.logger.debug(`Service [${name}] started successfully`);
        entry.state = 'running';
        if (
          Object.values(this.services).every(
            (service) => service.state === 'running',
          )
        ) {
          this.currentState = 'running';
        }
      })
      .catch((err) => {
        this.logger.error(`Error starting service ${name}`, err);
        entry.state = 'errored';
        entry.error = err;
        this.currentState = 'errored';
      });
  }

  private stopService(name: string) {
    this.logger.debug(`Attempting to stop service [${name}]`);
    const entry = this.services[name];
    if (!entry) {
      throw new Error(
        `Cannot stop service [${name}]: no service registered with that name`,
      );
    }
    if (
      entry.state === 'stopping' ||
      entry.state === 'stopped' ||
      entry.state === 'errored'
    ) {
      this.logger.warn(
        `Attempted to stop service [${name}] already in the [${entry.state}] state`,
      );
      return;
    }
    entry.state = 'stopping';
    entry.service
      .stop()
      .then(() => {
        entry.state = 'stopped';
        if (
          Object.values(this.services).every(
            (service) => service.state === 'stopped',
          )
        ) {
          if (this.healthServer) {
            this.logger.info('All services stopped, stopping health check.');
            this.healthServer.close();
            this.healthServer = undefined;
          }
          this.currentState = 'stopped';
        }
      })
      .catch((err) => {
        this.logger.error(`Error stopping service ${name}`, err);
        entry.state = 'errored';
        entry.error = err;
      });
  }

  registerService(service: IProcessManagerService) {
    const name = service.getName();

    if (this.services[name] !== undefined) {
      throw new Error(`Service with name [${name}] already registered`);
    }

    this.logger.debug(`Registered service: ${name}`);

    this.services[name] = {
      service,
      state: 'stopped',
    };
    if (this.currentState === 'running' || this.currentState === 'starting') {
      this.startService(name);
    }
  }

  getStatus(): IProcessStatus {
    return {
      state: this.currentState,
      processes: Object.keys(this.services).reduce(
        (acc, name) => ({
          ...acc,
          [name]: {
            state: this.services[name].state,
            error: this.services[name].error,
          },
        }),
        {},
      ),
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
          service.service.getHealth(),
        ]);
        return {
          name,
          serviceHealth,
        };
      }),
    );

    const services = serviceResults.reduce((acc, res) => {
      return {
        ...acc,
        [res.name]: res.serviceHealth,
      };
    }, {});

    return {
      healthy: serviceResults.every((sr) => sr.serviceHealth.healthy),
      services,
    };
  }

  start() {
    const health = new Koa();

    health.use(async (ctx, next) => {
      switch (ctx.request.path) {
        case '/healthz':
          const health = await this.getHealth();
          if (health.healthy) {
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

    this.healthServer = health.listen(this.options.healthPort);
    this.logger.info(
      `Health check listening on port ${this.options.healthPort}`,
    );
    this.currentState = 'starting';
    for (const service in this.services) {
      this.startService(service);
    }
  }

  stop() {
    this.currentState = 'stopping';
    for (const service in this.services) {
      this.stopService(service);
    }
  }
}
