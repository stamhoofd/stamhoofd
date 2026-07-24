import { Request, TestServer } from '@simonbackx/simple-endpoints';
import { CpuService } from '@stamhoofd/logging/CpuService';
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
