import { describe, expect, it } from 'vitest';
import { nextWatermark } from './sync-state.js';

describe('nextWatermark', () => {
    const runStartedAt = new Date(2026, 7, 6, 12, 0, 0);

    it('advances to the highest updatedAt it saw', () => {
        const seen = [new Date(2026, 7, 1), new Date(2026, 7, 5), new Date(2026, 7, 3)];

        expect(nextWatermark(new Date(2026, 6, 1), seen, runStartedAt)).toEqual(new Date(2026, 7, 5));
    });

    it('keeps the previous watermark when nothing changed', () => {
        const previous = new Date(2026, 6, 1);

        expect(nextWatermark(previous, [], runStartedAt)).toEqual(previous);
    });

    it('starts from nothing on a first run', () => {
        expect(nextWatermark(null, [], runStartedAt)).toBeNull();
    });

    /**
     * Registration periods carry an updatedAt in the future. Following one would put the watermark
     * weeks ahead and silently skip everything written until the clock caught up.
     */
    it('never moves past the start of the run, even when a source row is dated in the future', () => {
        const seen = [new Date(2026, 7, 5), new Date(2026, 8, 31)];

        expect(nextWatermark(null, seen, runStartedAt)).toEqual(runStartedAt);
    });

    it('repairs a watermark an earlier run already pushed into the future', () => {
        expect(nextWatermark(new Date(2026, 8, 31), [], runStartedAt)).toEqual(runStartedAt);
    });
});
