import { sleep } from '@stamhoofd/utility';
import { vi } from 'vitest';

import { waitUntilDeadline } from './waitUntilDeadline.js';

describe('Helper.waitUntilDeadline', () => {
    let errors: string[];

    beforeEach(() => {
        errors = [];
        vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
            errors.push(typeof message === 'string' ? message : String(message));
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const deadlineIn = (ms: number) => new Date(Date.now() + ms);

    test('returns as soon as the work finishes', async () => {
        const started = Date.now();
        await waitUntilDeadline(sleep(10), { deadline: deadlineIn(60_000), description: 'work' });

        expect(Date.now() - started).toBeLessThan(1000);
        expect(errors).toHaveLength(0);
    });

    test('gives up on work that never finishes', async () => {
        await waitUntilDeadline(new Promise(() => {}), { deadline: deadlineIn(20), description: 'work' });

        expect(errors).toContain('Gave up waiting for work to finish');
    });

    test('a deadline that already passed does not wait', async () => {
        await waitUntilDeadline(sleep(60_000), { deadline: deadlineIn(-1000), description: 'work' });

        expect(errors).toContain('Gave up waiting for work to finish');
    });

    test('a failure in the work is logged instead of thrown', async () => {
        await waitUntilDeadline(Promise.reject(new Error('Broken')), { deadline: deadlineIn(60_000), description: 'work' });

        expect(errors).toContain('Failed to wait for work:');
        expect(errors).not.toContain('Gave up waiting for work to finish');
    });
});
