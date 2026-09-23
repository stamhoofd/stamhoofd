import { afterEach, describe, expect, test } from 'vitest';
import type { MemorySample } from './MemoryService.js';
import { MemoryService } from './MemoryService.js';

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

function sample(overrides: Partial<MemorySample> = {}): MemorySample {
    return {
        heapUsed: 1 * GiB,
        heapLimit: 4 * GiB,
        rss: 1.5 * GiB,
        external: 200 * MiB,
        systemTotal: 16 * GiB,
        systemAvailable: 8 * GiB,
        ...overrides,
    };
}

function recordHealthyMinute() {
    for (let i = 0; i < 11; i++) {
        MemoryService.record(sample());
    }
}

describe('MemoryService', () => {
    afterEach(() => {
        MemoryService.clearForTesting();
    });

    test('takeSample reads the running process', () => {
        const s = MemoryService.takeSample();
        expect(s.heapUsed).toBeGreaterThan(0);
        expect(s.heapLimit).toBeGreaterThan(s.heapUsed);
        expect(s.rss).toBeGreaterThan(0);
        expect(s.systemTotal).toBeGreaterThan(s.systemAvailable);
    });

    test('reports no errors without samples', () => {
        expect(MemoryService.getErrors()).toEqual([]);
        expect(MemoryService.isInWarningZone()).toBe(false);
    });

    test('reports no errors while usage is normal', () => {
        MemoryService.record(sample());
        expect(MemoryService.getErrors()).toEqual([]);
    });

    describe('sustained usage', () => {
        test('reports a heap error when the average is close to the limit', () => {
            MemoryService.record(sample({ heapUsed: 3.6 * GiB }));
            expect(MemoryService.getErrors()).toEqual([
                'Heap memory usage is too high: 3.6 GiB of 4.0 GiB (90% average)',
            ]);
            expect(MemoryService.isInWarningZone()).toBe(true);
        });

        test('reports a system error when the average leaves little memory', () => {
            MemoryService.record(sample({ systemAvailable: 1.2 * GiB }));
            expect(MemoryService.getErrors()).toEqual([
                'System memory is almost exhausted: 1.2 GiB available of 16.0 GiB (93% used on average)',
            ]);
        });

        test('a single peak below the critical ratio inside a healthy window does not trigger an error', () => {
            recordHealthyMinute();
            MemoryService.record(sample({ heapUsed: 3.7 * GiB, systemAvailable: 1 * GiB }));

            expect(MemoryService.getHeapRatio()).toBeCloseTo((11 * 0.25 + 0.925) / 12);
            expect(MemoryService.getErrors()).toEqual([]);
        });

        test('only the last minute of samples counts', () => {
            for (let i = 0; i < 12; i++) {
                MemoryService.record(sample({ heapUsed: 1 * GiB }));
            }
            for (let i = 0; i < 12; i++) {
                MemoryService.record(sample({ heapUsed: 3.7 * GiB }));
            }

            expect(MemoryService.getHeapRatio()).toBeCloseTo(0.925);
            expect(MemoryService.getErrors()).toEqual([
                'Heap memory usage is too high: 3.7 GiB of 4.0 GiB (93% average)',
            ]);
        });
    });

    describe('critical usage', () => {
        test('reports a heap error on the first sample at the critical ratio, whatever the average', () => {
            recordHealthyMinute();
            MemoryService.record(sample({ heapUsed: 3.9 * GiB }));

            expect(MemoryService.getHeapRatio()).toBeLessThan(MemoryService.heapWarningRatio);
            expect(MemoryService.getErrors()).toEqual([
                'Heap memory usage is critical: 3.9 GiB of 4.0 GiB (98%)',
            ]);
        });

        test('reports a system error on the first sample where another process took the memory', () => {
            recordHealthyMinute();
            MemoryService.record(sample({ systemAvailable: 500 * MiB }));

            expect(MemoryService.getSystemUsedRatio()).toBeLessThan(MemoryService.systemUsedWarningRatio);
            expect(MemoryService.getErrors()).toEqual([
                'System memory is exhausted: 500 MiB available of 16.0 GiB (97% used)',
            ]);
        });

        test('reports each problem once when both the last sample and the average are bad', () => {
            for (let i = 0; i < 12; i++) {
                MemoryService.record(sample({ heapUsed: 3.9 * GiB, systemAvailable: 500 * MiB }));
            }

            expect(MemoryService.getErrors()).toEqual([
                'Heap memory usage is critical: 3.9 GiB of 4.0 GiB (98%)',
                'System memory is exhausted: 500 MiB available of 16.0 GiB (97% used)',
            ]);
        });

        test('clears again as soon as the memory is released', () => {
            MemoryService.record(sample({ systemAvailable: 500 * MiB }));
            expect(MemoryService.getErrors()).toHaveLength(1);

            MemoryService.record(sample());
            expect(MemoryService.getErrors()).toEqual([]);
        });
    });

    test('formats a sample for the log', () => {
        expect(MemoryService.formatSample(sample())).toBe(
            '[MEMORY] heap: 1.0 GiB / 4.0 GiB (25%), rss: 1.5 GiB, external: 200 MiB\n'
            + '[MEMORY] system available: 8.0 GiB / 16.0 GiB (50%)',
        );
    });
});
