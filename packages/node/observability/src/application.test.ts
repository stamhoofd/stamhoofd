import { expect, it, vi } from 'vitest';
import { channel } from 'node:diagnostics_channel';
import { runApplication } from './application.js';

const flush = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('./telemetry.js', () => ({ initializeTelemetry: () => ({ shutdown: flush }) }));

it('preserves initialization errors and flushes a failed startup before returning', async () => {
    const error = new Error('synthetic-secret');
    const events: unknown[] = [];
    const observer = (event: unknown) => {
        events.push(event);
    };
    const bus = channel('stamhoofd.application.lifecycle');
    bus.subscribe(observer);
    try {
        await expect(runApplication('api', () => Promise.reject(error))).rejects.toBe(error);
        expect(events).toEqual([
            { service: 'api', event: 'starting' },
            { service: 'api', event: 'failed' },
        ]);
        expect(flush).toHaveBeenCalledOnce();
    } finally {
        bus.unsubscribe(observer);
    }
});
