import IServiceStatus, { RunState } from './IServiceStatus';

export function combineServiceStates(states: RunState[]): RunState {
  if(states.every(s => s === 'running')) {
    return 'running';
  } else if(states.every(s => s === 'stopped')) {
    return 'stopped';
  } else if(states.some(s => s === 'errored')) {
    return 'errored';
  } else if(states.some(s => s === 'stopping')) {
    return 'stopping';
  } else if(states.some(s => s === 'starting')) {
    return 'starting';
  } else {
    return 'errored';
  }
}

export default interface IProcessStatus {
  state: RunState;
  services: {
    [key: string]: IServiceStatus;
  };
}
