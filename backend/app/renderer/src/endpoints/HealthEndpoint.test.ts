import { Request, TestServer } from '@simonbackx/simple-endpoints';
import { CpuService } from '@stamhoofd/logging/CpuService';
import { MemoryService } from '@stamhoofd/logging/MemoryService';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { HealthEndpoint } from './HealthEndpoint.js';

describe('Endpoint.Health', () => {
    const endpoint = new HealthEndpoint();
    const testServer = new TestServer();
    const key = 'health-test-key';

    beforeEach(() => {
        TestUtils.setEnvironment('HEALTH_ACCESS_KEY', key);
    });

    afterEach(() => {
        // Reset the CPU samples so a high-load test doesn't leak into the next one.
        CpuService.samples.fill(0);
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
        expect(response.body.errors).toBeUndefined();
    });

    test('Returns 503 when CPU usage is too high', async () => {
        CpuService.samples.fill(95);

        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
        expect(response.body.errors).toContain('CPU usage is too high');
    });

    test('Returns 503 when the heap has been almost full for a minute', async () => {
        const mib = 1024 * 1024;
        MemoryService.record({ heapUsed: 480 * mib, heapLimit: 512 * mib, rss: 900 * mib, external: 100 * mib, systemTotal: 8192 * mib, systemAvailable: 4096 * mib });

        const request = Request.get({
            path: '/health',
            query: { key },
        });

        const response = await testServer.test(endpoint, request);
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
        expect(response.body.errors).toEqual(['Heap memory usage is too high: 480 MiB of 512 MiB (94% average)']);
    });

    test('Rejects requests with a wrong key', async () => {
        const request = Request.get({
            path: '/health',
            query: { key: 'wrong-key' },
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(
            STExpect.simpleError({ code: 'unauthorized', statusCode: 401 }),
        );
    });

    test('Rejects requests without a key', async () => {
        const request = Request.get({
            path: '/health',
        });

        await expect(testServer.test(endpoint, request)).rejects.toThrow(
            STExpect.simpleError({ code: 'unauthorized', statusCode: 401 }),
        );
    });
});
