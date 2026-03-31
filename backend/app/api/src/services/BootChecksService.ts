import { DatabaseCollationService } from './DatabaseCollationService.js';
import { StartupHealthService } from './StartupHealthService.js';

export class BootChecksService {
    static async checkDatabaseCollation() {
        const collationMismatchError = await DatabaseCollationService.getMismatchError();

        if (!collationMismatchError) {
            return;
        }

        if (STAMHOOFD.environment === 'production') {
            console.error(collationMismatchError);
            console.error('Health endpoint will keep returning a non-2xx status until the process is restarted with a fixed database collation.');
            StartupHealthService.markUnhealthy(collationMismatchError);
            return;
        }

        throw new Error(collationMismatchError);
    }
}
