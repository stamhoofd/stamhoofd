import type { Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { createTestEmitter, emptyTestCounts } from '@stamhoofd/cli/test-events';

/** Keeps retries out of completed counts and reports final outcomes from Playwright itself. */
export default class ProgressReporter implements Reporter {
    private readonly emitter = createTestEmitter();
    private suite?: Suite;
    private readonly completed = new Set<string>();

    onBegin(_config: unknown, suite: Suite) {
        this.suite = suite;
    }

    onTestEnd(test: TestCase, result: TestResult) {
        if (result.status !== 'skipped' && result.status !== test.expectedStatus && result.retry < test.retries) return;
        this.completed.add(test.id);
        this.publish(false);
    }

    private publish(finished: boolean) {
        const tests = this.suite?.allTests() ?? [];
        const counts = emptyTestCounts();
        for (const test of tests) {
            if (!finished && !this.completed.has(test.id)) continue;
            if (!test.results.length) counts.pending++;
            else {
                const outcome = test.outcome();
                if (outcome === 'unexpected') counts.failed++;
                else if (outcome === 'expected') counts.passed++;
                else counts[outcome]++;
            }
        }
        this.emitter.emit({ ...counts, completed: finished ? tests.length - counts.pending : this.completed.size, total: tests.length, finished });
    }

    async onEnd() {
        this.publish(true);
        await this.emitter.close();
    }
}
