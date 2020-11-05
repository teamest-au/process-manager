import IServiceHealth from "./IServiceHealth";

export default interface IProcessHealth {
  healthy: boolean;
  services: {
    [key: string]: IServiceHealth;
  };
}
