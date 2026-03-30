import { Database } from '@simonbackx/simple-database';
import { DatabaseCollationService } from './DatabaseCollationService.js';

describe('DatabaseCollationService', () => {
    test('Detects collation_connection mismatch', async () => {
        await Database.statement('SET collation_connection = \'utf8mb4_general_ci\'');

        try {
            const error = await DatabaseCollationService.getMismatchError();
            expect(error).toContain('MySQL collation mismatch');
            expect(error).toContain('expected utf8mb4_0900_ai_ci');
            expect(error).toContain('collation_connection=utf8mb4_general_ci');
        }
        finally {
            await Database.statement('SET collation_connection = DEFAULT');
        }
    });
});
