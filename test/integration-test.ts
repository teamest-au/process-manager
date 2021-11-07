import { assert } from 'chai';
import axios from 'axios';
import { BunyanLogger as Logger } from '@danielemeryau/logger';

import { ProcessManager } from '../index';
import MockService from './mock-service';

const HEALTH_PORT = 5000;

const logger = new Logger('process-manager/integration-test', 'debug');

async function tick(): Promise<void> {
  return new Promise((res) => setTimeout(() => res(), 10));
}

async function getHealthZ() {
  let response;
  try {
    response = await axios.get(`http://localhost:${HEALTH_PORT}/healthz`);
  } catch (err: any) {
    response = err.response;
  }
  return {
    status: response.status,
    value: response.data,
  };
}

async function getReadyZ() {
  let response;
  try {
    response = await axios.get(`http://localhost:${HEALTH_PORT}/readyz`);
  } catch (err: any) {
    response = err.response;
  }
  return {
    status: response.status,
    value: response.data,
  };
}

async function runIntegrationTests() {
  const pm = new ProcessManager(logger, {
    healthResponseTimeMs: 1000,
    healthPort: HEALTH_PORT,
  });

  const serviceOne = new MockService('serviceOne');
  const serviceTwo = new MockService('serviceTwo');

  // Initial statuses
  let currentStatus = pm.getStatus();
  assert.deepEqual(currentStatus, {
    state: 'stopped',
    services: {},
  });
  let currentHealth = await pm.getHealth();
  assert.deepEqual(currentHealth, {
    healthy: 'healthy',
    services: {},
  });

  // Statuses after registration
  pm.registerService(serviceOne);
  pm.registerService(serviceTwo);
  // await tick();

  currentStatus = pm.getStatus();

  console.log(currentStatus);

  assert.equal(currentStatus.state, 'stopped');
  assert.equal(currentStatus.services['serviceOne'].state, 'stopped');
  assert.equal(currentStatus.services['serviceTwo'].state, 'stopped');

  // Starting statuses
  pm.start();
  await tick();

  currentStatus = pm.getStatus();
  let currentReadyZResult = await getReadyZ();
  assert.equal(currentStatus.state, 'starting');
  assert.equal(currentStatus.services['serviceOne'].state, 'starting');
  assert.equal(currentStatus.services['serviceTwo'].state, 'starting');
  assert.equal(currentReadyZResult.status, 503);

  // Partially started statuses
  serviceOne.mockNext();
  // await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'starting');
  assert.equal(currentStatus.services['serviceOne'].state, 'running');
  assert.equal(currentStatus.services['serviceTwo'].state, 'starting');

  // Fully started statuses
  serviceTwo.mockNext();
  // await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'running');
  assert.equal(currentStatus.services['serviceOne'].state, 'running');
  assert.equal(currentStatus.services['serviceTwo'].state, 'running');

  // Healthy statuses
  currentHealth = await pm.getHealth();
  let currentHealthZResult = await getHealthZ();
  assert.equal(currentHealth.healthy, 'healthy');
  assert.equal(currentHealth.services['serviceOne'].healthy, 'healthy');
  assert.equal(currentHealth.services['serviceTwo'].healthy, 'healthy');
  assert.equal(currentHealthZResult.status, 200);
  assert.deepEqual(currentHealthZResult.value, currentHealth);

  // Unhealthy statuses
  serviceOne.mockHealth('unhealthy');

  currentHealth = await pm.getHealth();
  currentHealthZResult = await getHealthZ();
  assert.equal(currentHealth.healthy, 'unhealthy');
  assert.equal(currentHealth.services['serviceOne'].healthy, 'unhealthy');
  assert.equal(currentHealth.services['serviceTwo'].healthy, 'healthy');
  assert.equal(currentHealthZResult.status, 503);
  assert.deepEqual(currentHealthZResult.value, currentHealth);

  // Stopping statuses
  pm.stop();
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopping');
  assert.equal(currentStatus.services['serviceOne'].state, 'stopping');
  assert.equal(currentStatus.services['serviceTwo'].state, 'stopping');

  // Partially stopped statuses
  serviceTwo.mockNext();
  // await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopping');
  assert.equal(currentStatus.services['serviceOne'].state, 'stopping');
  assert.equal(currentStatus.services['serviceTwo'].state, 'stopped');

  // Fully stopped status
  serviceOne.mockNext();
  // await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopped');
  assert.equal(currentStatus.services['serviceOne'].state, 'stopped');
  assert.equal(currentStatus.services['serviceTwo'].state, 'stopped');

  // Partial error status
  pm.start();
  await tick();
  
  const startError = 'Failed to start service 2';
  serviceOne.mockNext();
  serviceTwo.mockNext(startError);

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'errored');
  assert.equal(currentStatus.services['serviceOne'].state, 'running');
  assert.equal(currentStatus.services['serviceTwo'].state, 'errored');
  assert.deepEqual(currentStatus.services['serviceTwo'].message, startError);
}

runIntegrationTests()
  .then(() => {
    logger.info('Integration test completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    logger.error('Unexpected error running integration tests', err);
    process.exit(1);
  });
