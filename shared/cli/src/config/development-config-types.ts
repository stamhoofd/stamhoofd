import type { SharedEnvironment, StatisticsEnvironment } from '@stamhoofd/types/Environment';
import type { BackendApp } from '@stamhoofd/types/BackendApp';
import type { FrontendApp } from '@stamhoofd/types/FrontendApp';

export type BackendAppService = { backend: BackendApp };
export type FrontendAppService = { frontend: FrontendApp };
export type AppService = BackendAppService | FrontendAppService;

/**
 * The statistics syncer moves rows between two databases and needs no platform configuration.
 */
export type AppEnvironment = SharedEnvironment | StatisticsEnvironment;
