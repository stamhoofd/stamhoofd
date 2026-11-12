import { Chalk } from 'chalk';
import { afterEach, expect, it, vi } from 'vitest';
import { DevStatus, formatDevStatus } from './dev-status.js';
import { isPortListening } from './port-probe.js';

vi.mock('./port-probe.js', () => ({ isPortListening: vi.fn(async () => false) }));
afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

const apps = [
    {
        id: 'dashboard' as const,
        label: 'dashboard.stamhoofd',
        href: 'https://dashboard.stamhoofd',
        port: 8080,
    },
    { id: 'stats' as const, label: 'stats' },
];

it('attributes short-prefix warnings only to their application', () => {
    const status = new DevStatus(apps, () => {});
    status.observe('stdout', '[apps] [dashboard] WARN outdated dependency\n');
    expect(status.items().map((app) => app.state)).toEqual(['warning', 'starting']);
    status.stop();
});

it('shows listener readiness, tolerates a missed check, and detects loss and recovery', async () => {
    const status = new DevStatus(apps, () => {});
    expect(status.items()[0].state).toBe('starting');
    vi.mocked(isPortListening).mockResolvedValue(true);
    await status.check();
    expect(status.items()[0].state).toBe('running');
    vi.mocked(isPortListening).mockResolvedValue(false);
    await status.check();
    expect(status.items()[0].state).toBe('starting');
    await status.check();
    expect(status.items()[0].state).toBe('failed');
    vi.mocked(isPortListening).mockResolvedValue(true);
    await status.check();
    expect(status.items()[0].state).toBe('running');
    status.stop();
});

it('keeps a warning orange for thirty seconds without losing running state', async () => {
    vi.useFakeTimers();
    const status = new DevStatus(apps, () => {});
    vi.mocked(isPortListening).mockResolvedValue(true);
    await status.check();
    status.observe('stdout', '[apps] @stamhoofd/web-app:dev: WARN outdated dependency\n');
    expect(status.items()[0].state).toBe('warning');
    vi.advanceTimersByTime(30_000);
    expect(status.items()[0].state).toBe('running');
    status.stop();
});

it('tracks split worker lifecycle messages and does not treat arbitrary stderr as failure', () => {
    const status = new DevStatus(apps, () => {});
    status.observe('stdout', '[apps] @stamhoofd/backend-statistics-syncer:dev: Started Stat');
    status.observe('stderr', '[apps] @stamhoofd/web-app:dev: normal diagnostic\n');
    status.observe('stdout', 'istics.\n');
    expect(status.items()[1].state).toBe('running');
    expect(status.items()[0].state).toBe('starting');
    status.observe(
        'stderr',
        '[apps] @stamhoofd/backend-statistics-syncer:dev: [nodemon] app crashed - waiting for file changes before starting...\n',
    );
    expect(status.items()[1].state).toBe('failed');
    status.observe(
        'stdout',
        '[apps] @stamhoofd/backend-statistics-syncer:dev: [nodemon] restarting due to changes...\n',
    );
    expect(status.items()[1].state).toBe('starting');
    status.stop();
});

it('keeps an explicit restart blue while the listener is temporarily unavailable', async () => {
    const status = new DevStatus(apps, () => {});
    vi.mocked(isPortListening).mockResolvedValue(true);
    await status.check();
    status.observe('stdout', '[apps] @stamhoofd/web-app:dev: server restarting...\n');
    vi.mocked(isPortListening).mockResolvedValue(false);
    await status.check();
    await status.check();
    expect(status.items()[0].state).toBe('starting');
    status.stop();
});

it('ignores in-flight probe results after stopping and releases its timer', async () => {
    vi.useFakeTimers();
    let resolve!: (value: boolean) => void;
    vi.mocked(isPortListening).mockReturnValue(
        new Promise<boolean>((done) => {
            resolve = done;
        }),
    );
    const changed = vi.fn();
    const status = new DevStatus(apps, changed);
    status.start();
    const pending = status.check();
    status.stop();
    changed.mockClear();
    resolve(true);
    await pending;
    expect(changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});

it('renders compact dimmed, colored OSC-8 links and plain labels when redirected', () => {
    const colors = new Chalk({ level: 3 });
    const app = { ...apps[0], state: 'running' as const };
    const formatted = formatDevStatus(app, true, colors);
    expect(formatted).toContain('\x1b[2m');
    expect(formatted).toContain('\x1b[4m');
    expect(formatted).toContain('\x1b[32m');
    expect(formatted).toContain(
        '\x1b]8;;https://dashboard.stamhoofd\x1b\\dashboard.stamhoofd\x1b]8;;\x1b\\',
    );
    expect(formatDevStatus(app, false, colors)).toBe('dashboard.stamhoofd');
    expect(
        formatDevStatus({ id: 'stats', label: 'stats', state: 'warning' }, true, colors),
    ).toContain('\x1b[38;2;255;165;0m');
});
