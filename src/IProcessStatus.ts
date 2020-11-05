import RunState from './RunState';

export default interface IProcessStatus {
  state: RunState;
  processes: {
    [key: string]: {
      state: RunState;
      error?: any;
    };
  };
}
