export interface IDbConnectionDetails {
  host: string;
  user: string;
  password: string;
  database: string;
}

export interface IQueueConnectionDetails {
  host: string;
  port: string;
  user: string;
  password: string;
}

export default interface IProcessManagerOptions {
  /** How long to wait until considering a non-responsive health check unhealthy  */
  healthResponseTimeMs: number;
  dbConnectionDetails?: IDbConnectionDetails;
  queueConnectionDetails?: IQueueConnectionDetails;
}
