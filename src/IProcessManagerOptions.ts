export default interface IProcessManagerOptions {
  /** Port that the health check server should listen on. */
  healthPort: number;
  /** How long to wait until considering a non-responsive service unhealthy. */
  healthResponseTimeMs: number;
}
