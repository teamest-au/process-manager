# Process Manager

Generic process manager for the teamest Microservice ecosystem

## Features

- Provides an api to support a health check endpoint
- Supports retries when waiting for certain service dependencies (eg mysql or rabbit)
- Catches application level errors and attempts to restart
- Performs validation of environment variables on start

## Usage

```ts
import { ProcessManager, waitUntilReady } from '@teamest/process-manager';
import { BunyanLogger as Logger } from '@danielemeryau/logger';

const logger = new Logger('process-manager/my-service');

const processManager = new ProcessManager(logger, {
  healthResponseTimeMs: 1000,
  healthPort: 5000,
});

const myService = new MyService(); // Where service `implements IProcessManagerService`
processManager.registerService()

pm.start();
const currentStatus = pm.getStatus(); // Status will be starting

await waitUntilReady([myService], 1000, 'healthy');

const currentStatus = pm.getStatus(); // Status should be healthy
```

- Hitting `/healthz` on port 5000 now should return 200 when healthy or 503 when unhealthy (along with individual statuses)
- Hitting `/readyz` on port 5000 should return 200 when ready or 503 when starting or unhealthy
