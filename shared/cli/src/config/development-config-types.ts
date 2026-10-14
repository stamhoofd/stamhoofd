import type { SharedEnvironment, StatisticsEnvironment } from '@stamhoofd/types/Environment';

export type BackendAppName = 'api' | 'renderer' | 'redirecter' | 'backup' | 'statistics-syncer';
export type FrontendAppName = 'webshop' | 'calculator' | 'mobile' | 'web-app';

export type BackendAppService = { backend: BackendAppName };
export type FrontendAppService = { frontend: FrontendAppName };
export type AppService = BackendAppService | FrontendAppService;
export type AppEnvironment = SharedEnvironment | StatisticsEnvironment;
