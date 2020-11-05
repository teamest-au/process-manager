import { assert } from 'chai';
import Logger from '@danielemeryau/logger';

import { ProcessManager } from '..';
import MockService from './mock-service';

const logger = new Logger('process-manager/integration-test', 'debug');

async function tick(): Promise<void> {
  return new Promise((res) => setTimeout(() => res(), 10));
}

async function runIntegrationTests() {
  const pm = new ProcessManager(logger, {
    healthResponseTimeMs: 1000,
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
    services: {}
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
  assert.equal(currentStatus.state, 'starting');
  assert.equal(currentStatus.processes['serviceOne'].state, 'starting');
  assert.equal(currentStatus.processes['serviceTwo'].state, 'starting');
  
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
  assert.equal(currentHealth.healthy, true);
  assert.equal(currentHealth.services['serviceOne'].healthy, true);
  assert.equal(currentHealth.services['serviceTwo'].healthy, true);

  // Unhealthy statuses
  serviceOne.mockHealth(false);

  currentHealth = await pm.getHealth();
  assert.equal(currentHealth.healthy, false);
  assert.equal(currentHealth.services['serviceOne'].healthy, false);
  assert.equal(currentHealth.services['serviceTwo'].healthy, true);

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

runIntegrationTests().then(() => {
  logger.info('Integration test completed successfully');
  process.exit(0);
}).catch(err => {
  logger.error('Unexpected error running integration tests', err);
  process.exit(1);
});
