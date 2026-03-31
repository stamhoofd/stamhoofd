import { Request } from '@simonbackx/simple-endpoints';
import { TestUtils } from '@stamhoofd/test-utils';
import { testServer } from '../../../tests/helpers/TestServer.js';
import { StartupHealthService } from '../../services/StartupHealthService.js';
import { HealthEndpoint } from './HealthEndpoint.js';

describe('Endpoint.HealthEndpoint', () => {
    const endpoint = new HealthEndpoint();
    const key = 'health-test-key';

    beforeEach(() => {
        TestUtils.setEnvironment('HEALTH_ACCESS_KEY', key);
        StartupHealthService.clearForTesting();
    });

    afterEach(() => {
        StartupHealthService.clearForTesting();
    });

    test('Returns 200 when healthy', async () => {
        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
    });

    test('Returns 503 with startup error details', async () => {
        StartupHealthService.markUnhealthy('MySQL collation mismatch: expected utf8mb4_0900_ai_ci, got collation_connection=utf8mb4_general_ci');

        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
        expect(response.body.errors).toContain('MySQL collation mismatch: expected utf8mb4_0900_ai_ci, got collation_connection=utf8mb4_general_ci');
    });
});
