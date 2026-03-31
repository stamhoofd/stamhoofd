import { CaddyConfigHelper } from './CaddyConfigHelper.js';
import { DatabaseHelper } from './DatabaseHelper.js';
import { NetworkHelper } from './NetworkHelper.js';
import type { ServiceHelper, ServiceProcess } from './ServiceHelper.js';
export class ApiService implements ServiceHelper {
    constructor(private workerId: string) {}

    async start(): Promise<ServiceProcess> {
        const domain = CaddyConfigHelper.getDomain('api', this.workerId);

        // Start api
        const { run: runMigrations }
            = await import('@stamhoofd/backend/migrate');
        await runMigrations();

        // Clear database before we start
        const databaseHelper = new DatabaseHelper(this.workerId);

        await databaseHelper.clear();

        console.log(`Database cleared for worker ${this.workerId}.`);

        const { boot } = await import('@stamhoofd/backend/boot');
        const { shutdown } = await boot({ killProcess: false });

        return {
            wait: async () => {
                console.log('Waiting for backend server...');
                await NetworkHelper.waitForUrl(
                    'https://' + domain + '/organizations/search',
                );
                console.log('Backend server ready');
            },
            kill: async () => {
                await shutdown();
            },
        };
    }
}
