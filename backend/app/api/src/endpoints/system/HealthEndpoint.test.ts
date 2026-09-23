import { Request } from '@simonbackx/simple-endpoints';
import { MemoryService } from '@stamhoofd/logging/MemoryService';
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
        MemoryService.clearForTesting();
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

    test('Returns 503 when the heap is almost full', async () => {
        const gib = 1024 * 1024 * 1024;
        MemoryService.record({ heapUsed: 3.9 * gib, heapLimit: 4 * gib, rss: 4.2 * gib, external: 0.1 * gib, systemTotal: 16 * gib, systemAvailable: 8 * gib });

        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
        expect(response.body.errors).toEqual(['Heap memory usage is critical: 3.9 GiB of 4.0 GiB (98%)']);
    });

    test('Returns 503 when the system is out of memory', async () => {
        const gib = 1024 * 1024 * 1024;
        MemoryService.record({ heapUsed: 1 * gib, heapLimit: 4 * gib, rss: 1.5 * gib, external: 0.1 * gib, systemTotal: 8 * gib, systemAvailable: 300 * 1024 * 1024 });

        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(503);
        expect(response.body.errors).toEqual(['System memory is exhausted: 300 MiB available of 8.0 GiB (96% used)']);
    });
});
