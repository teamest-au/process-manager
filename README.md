# Process Manager

Generic process manager for the teamest Microservice ecosystem

## Features

- Provides an api to support a health check endpoint
- Supports retries when waiting for certain service dependencies (eg mysql or rabbit)
- Catches application level errors and attempts to restart
- Performs validation of environment variables on start

## Usage

```ts
import processManager from '@teamest/process-manager';
```
