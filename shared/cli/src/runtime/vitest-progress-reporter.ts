import type { Reporter, TestCase, TestModule } from 'vitest/node';
import { createTestEmitter, emptyTestCounts } from './test-events.js';
import type { TestCounts } from './test-events.js';

/** Adds structured counters alongside Vitest's own failure diagnostics; never parses console output. */
export default class VitestProgressReporter implements Reporter {
    private readonly emitter = createTestEmitter();
    private counts = emptyTestCounts();
    private readonly outcomes = new Map<string, keyof TestCounts>();

    onTestCaseResult(test: TestCase) {
        this.record(test);
        this.publish(false);
    }

    private record(test: TestCase) {
        const state = test.result().state;
        const outcome = test.options.mode === 'todo' ? 'todo' : state === 'passed' && test.diagnostic()?.flaky ? 'flaky' : state === 'passed' || state === 'failed' || state === 'skipped' ? state : 'pending';
        const previous = this.outcomes.get(test.id);
        if (previous) this.counts[previous]--;
        this.outcomes.set(test.id, outcome);
        this.counts[outcome]++;
    }

    private publish(finished: boolean) {
        const completed = this.outcomes.size - this.counts.pending;
        this.emitter.emit({ ...this.counts, completed, ...(finished ? { total: this.outcomes.size } : {}), finished });
    }

    async onTestRunEnd(modules: ReadonlyArray<TestModule>) {
        this.counts = emptyTestCounts();
        this.outcomes.clear();
        for (const module of modules) {
            for (const test of module.children.allTests()) this.record(test);
        }
        this.publish(true);
        await this.emitter.close();
    }
}
