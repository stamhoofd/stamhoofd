import { afterEach, expect, it, vi } from 'vitest';
import type { CliContext } from './create-context.js';
import { resolvePortOffset } from './port-allocation.js';
import { isPortAvailable } from '../runtime/port-probe.js';

vi.mock('../runtime/port-probe.js', () => ({ isPortAvailable: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

it('moves the instance range when a debugger port is occupied', async () => {
    vi.stubEnv('STAMHOOFD_PORT_OFFSET_LOCKED', '');
    vi.stubEnv('STAMHOOFD_PORT_OFFSET', '');
    vi.mocked(isPortAvailable).mockImplementation(async port => port !== 5858);
    const context = { instance: { name: 'test', portOffset: 0 } } as CliContext;
    expect((await resolvePortOffset(context)).instance.portOffset).toBe(100);
    expect(isPortAvailable).toHaveBeenCalledWith(5958);
});
