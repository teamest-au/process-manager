import { assert } from 'chai';
import axios from 'axios';
import Logger from '@danielemeryau/logger';

import { ProcessManager } from '..';
import MockService from './mock-service';

const HEALTH_PORT = 5000;

const logger = new Logger('process-manager/integration-test', 'debug');

async function tick(): Promise<void> {
  return new Promise((res) => setTimeout(() => res(), 10));
}

async function getHealthZ() {
  let response;
  try {
    response = await axios.get(
      `http://localhost:${HEALTH_PORT}/healthz`,
    );
  } catch (err) {
    response = err.response;
  }
  return {
    status: response.status,
    value: response.data,
  }
}

async function getReadyZ() {
  let response;
  try {
    response = await axios.get(
      `http://localhost:${HEALTH_PORT}/readyz`,
    );
  } catch (err) {
    response = err.response;
  }
  return {
    status: response.status,
    value: response.data,
  }
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
    processes: {},
  });
  let currentHealth = await pm.getHealth();
  assert.deepEqual(currentHealth, {
    healthy: true,
    services: {},
  });

  // Statuses after registration
  pm.registerService(serviceOne);
  pm.registerService(serviceTwo);
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopped');
  assert.equal(currentStatus.processes['serviceOne'].state, 'stopped');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'stopped');

  // Starting statuses
  pm.start();

  currentStatus = pm.getStatus();
  let currentReadyZResult = await getReadyZ();
  assert.equal(currentStatus.state, 'starting');
  assert.equal(currentStatus.processes['serviceOne'].state, 'starting');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'starting');
  assert.equal(currentReadyZResult.status, 503);

  // Partially started statuses
  serviceOne.mockStarted();
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'starting');
  assert.equal(currentStatus.processes['serviceOne'].state, 'running');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'starting');

  // Fully started statuses
  serviceTwo.mockStarted();
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'running');
  assert.equal(currentStatus.processes['serviceOne'].state, 'running');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'running');

  // Healthy statuses
  currentHealth = await pm.getHealth();
  let currentHealthZResult = await getHealthZ();
  assert.equal(currentHealth.healthy, true);
  assert.equal(currentHealth.services['serviceOne'].healthy, true);
  assert.equal(currentHealth.services['serviceTwo'].healthy, true);
  assert.equal(currentHealthZResult.status, 200);
  assert.deepEqual(currentHealthZResult.value, currentHealth);

  // Unhealthy statuses
  serviceOne.mockHealth(false);

  currentHealth = await pm.getHealth();
  currentHealthZResult = await getHealthZ();
  assert.equal(currentHealth.healthy, false);
  assert.equal(currentHealth.services['serviceOne'].healthy, false);
  assert.equal(currentHealth.services['serviceTwo'].healthy, true);
  assert.equal(currentHealthZResult.status, 503);
  assert.deepEqual(currentHealthZResult.value, currentHealth);

  // Stopping statuses
  pm.stop();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopping');
  assert.equal(currentStatus.processes['serviceOne'].state, 'stopping');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'stopping');

  // Partially stopped statuses
  serviceTwo.mockStopped();
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopping');
  assert.equal(currentStatus.processes['serviceOne'].state, 'stopping');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'stopped');

  // Fully stopped status
  serviceOne.mockStopped();
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'stopped');
  assert.equal(currentStatus.processes['serviceOne'].state, 'stopped');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'stopped');

  // Partial error status
  pm.start();
  const startError = new Error('Failed to start service 2');
  serviceOne.mockStarted();
  serviceTwo.mockStarted(startError);
  await tick();

  currentStatus = pm.getStatus();
  assert.equal(currentStatus.state, 'errored');
  assert.equal(currentStatus.processes['serviceOne'].state, 'running');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'errored');
  assert.deepEqual(currentStatus.processes['serviceTwo'].error, startError);
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
