import { afterEach, expect, it, vi } from 'vitest';
// eslint-disable-next-line import/no-relative-packages -- Exercise the owning adapter without adding a reverse workspace dependency.
import ProgressReporter from '../../../../tests/playwright/src/reporters/progress.js';
import { openTestEventChannel } from './test-events.js';
import type { TestProgress } from './test-events.js';

afterEach(() => vi.unstubAllEnvs());

it('counts retry outcomes once and preserves flaky, expected-failure and interrupted results', async () => {
    const events: TestProgress[] = [];
    const channel = await openTestEventChannel(event => events.push(event));
    vi.stubEnv('STAM_TEST_SOCKET', channel.env.STAM_TEST_SOCKET);
    vi.stubEnv('STAM_TEST_SESSION', channel.env.STAM_TEST_SESSION);
    const reporter = new ProgressReporter();
    const retry = { id: 'retry', expectedStatus: 'passed', retries: 1, results: [{}], outcome: () => 'flaky' };
    const tests = [
        retry,
        { id: 'expected failure', results: [{}], outcome: () => 'expected' },
        { id: 'skip', results: [{}], outcome: () => 'skipped' },
        { id: 'not run', results: [], outcome: () => 'skipped' },
    ];
    try {
        reporter.onBegin(undefined, { allTests: () => tests } as never);
        reporter.onTestEnd(retry as never, { status: 'failed', retry: 0 } as never);
        expect(events).toHaveLength(0);
        reporter.onTestEnd(retry as never, { status: 'passed', retry: 1 } as never);
        await reporter.onEnd();
        expect(events.at(-1)).toMatchObject({ passed: 1, flaky: 1, skipped: 1, pending: 1, completed: 3, total: 4, finished: true });
    } finally {
        await channel.close();
    }
});
