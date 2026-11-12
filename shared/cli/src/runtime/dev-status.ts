import { chalkStderr } from 'chalk';
import type { ChalkInstance } from 'chalk';
import { stripVTControlCharacters } from 'node:util';
import { isPortListening } from './port-probe.js';
import type { DevEvent } from '@node/dev-tools/events';

export type DevAppId = 'dashboard' | 'api' | 'docs' | 'webshop' | 'renderer' | 'stats';
export type DevApp = { id: DevAppId; label: string; href?: string; port?: number };
export type DevAppState = 'starting' | 'running' | 'warning' | 'failed';
type AppState = {
    state: Exclude<DevAppState, 'warning'>;
    warningUntil: number;
    missed: number;
    revision: number;
};

const packages = new Map<string, DevAppId>([
    ['web-app', 'dashboard'],
    ['backend', 'api'],
    ['webshop', 'webshop'],
    ['backend-renderer', 'renderer'],
    ['backend-statistics-syncer', 'stats'],
]);

/**
 * Combines structured development lifecycles with listener-loss detection and recent warnings.
 * @remarks Listener availability is not full application health. Structured readiness
 * takes precedence over listener recovery and parsed startup messages. Statistics
 * has no listener. The caller retains all observed output for normal presentation.
 * Call stop to release monitoring before disposing the output destination.
 */
export class DevStatus {
    private readonly states = new Map<DevAppId, AppState>();
    private readonly pending = new Map<string, string>();
    private timer?: ReturnType<typeof setInterval>;
    private checking?: Promise<void>;
    private stopped = false;
    private signature = '';
    private readonly structured = new Map<DevAppId, boolean>();
    private readonly builds = new Map<string, 'building' | 'failed'>();

    constructor(
        private readonly apps: readonly DevApp[],
        private readonly changed: () => void,
    ) {
        for (const app of apps)
            this.states.set(app.id, { state: 'starting', warningUntil: 0, missed: 0, revision: 0 });
    }

    items(): (DevApp & { state: DevAppState })[] {
        return this.apps.map((app) => {
            const value = this.states.get(app.id)!;
            const builds = [
                this.builds.get(app.id),
                app.id !== 'docs' ? this.builds.get('shared') : undefined,
            ];
            const state =
                value.state === 'failed'
                    ? 'failed'
                    : builds.includes('failed')
                      ? value.state === 'running'
                          ? 'warning'
                          : 'failed'
                      : value.warningUntil > Date.now()
                        ? 'warning'
                        : value.missed > 0 || builds.includes('building')
                          ? 'starting'
                          : value.state;
            return { ...app, state };
        });
    }

    start(): void {
        if (this.stopped || this.timer) return;
        void this.check();
        this.timer = setInterval(() => {
            void this.check();
        }, 1000);
    }

    /** Two missed listener checks turn a previously running app red; explicit restarts stay blue. */
    check(): Promise<void> {
        if (this.stopped) return Promise.resolve();
        if (this.checking) return this.checking;
        this.checking = Promise.all(
            this.apps.map(async (app) => {
                if (app.port === undefined) return;
                const value = this.states.get(app.id)!;
                const revision = value.revision;
                const listening = await isPortListening(app.port).catch(() => false);
                if (this.stopped || revision !== value.revision) return;
                if (listening && this.structured.get(app.id) !== false) {
                    value.state = 'running';
                    value.missed = 0;
                } else if (value.state === 'running' && ++value.missed >= 2) {
                    value.state = 'failed';
                }
            }),
        )
            .then(() => this.publish())
            .finally(() => {
                this.checking = undefined;
            });
        return this.checking;
    }

    /**
     * Applies one accepted lifecycle transition and publishes changed visible state.
     * @param event - Session event already filtered by DevLifecycle for stale processes/cycles.
     * @remarks Compilation is independent of availability: failed rebuilds keep an
     * existing ready server orange. Calls after stop are ignored.
     */
    event(event: DevEvent): void {
        if (this.stopped) return;
        if (event.event.startsWith('build.')) {
            if (event.event === 'build.succeeded') this.builds.delete(event.app);
            else this.builds.set(event.app, event.event === 'build.failed' ? 'failed' : 'building');
        } else if (event.app !== 'shared') {
            const value = this.states.get(event.app);
            if (!value) return;
            this.structured.set(event.app, event.event === 'ready');
            value.state =
                event.event === 'ready'
                    ? 'running'
                    : event.event === 'stopped'
                      ? 'failed'
                      : 'starting';
            value.missed = 0;
            value.revision++;
        }
        this.publish();
    }

    /** Observe complete lines independently per stream; never retain unbounded subprocess output. */
    observe(stream: string, chunk: string): void {
        if (this.stopped) return;
        const lines = ((this.pending.get(stream) ?? '') + chunk).split('\n');
        this.pending.set(stream, lines.pop()!.slice(-65536));
        for (const line of lines) this.line(stripVTControlCharacters(line));
        this.publish();
    }

    warn(): void {
        for (const value of this.states.values()) value.warningUntil = Date.now() + 30_000;
        this.publish();
    }

    fail(): void {
        for (const value of this.states.values()) {
            value.state = 'failed';
            value.revision++;
        }
        this.publish();
    }

    stop(): void {
        this.stopped = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        this.pending.clear();
    }

    private publish(): void {
        if (this.stopped) return;
        const signature = this.items()
            .map((item) => item.state)
            .join(',');
        if (signature === this.signature) return;
        this.signature = signature;
        this.changed();
    }

    private line(line: string): void {
        const source = /^\[(apps|docs|shared)\]/.exec(line);
        if (!source) return;
        const message = line.slice(source[0].length).trimStart();
        const short = /^\[(dashboard|api|webshop|renderer|stats)\] /.exec(message);
        const match = /^@stamhoofd\/([^:]+):dev:/.exec(message);
        const id =
            source[1] === 'docs'
                ? 'docs'
                : short
                  ? (short[1] as DevAppId)
                  : match
                    ? packages.get(match[1])
                    : undefined;
        if (match && !id) return;
        const text = short
            ? message.slice(short[0].length)
            : match
              ? message.slice(match[0].length).trimStart()
              : message;
        const affected = id
            ? [id]
            : this.apps
                  .filter((app) => source[1] !== 'docs' && app.id !== 'docs')
                  .map((app) => app.id);
        for (const app of affected) {
            const value = this.states.get(app);
            if (!value) continue;
            if (
                !this.structured.has(app) &&
                /\[nodemon\] app crashed|exited with code [1-9]\d*|command finished with error/.test(
                    text,
                )
            ) {
                value.state = 'failed';
                value.revision++;
            } else if (
                !this.structured.has(app) &&
                /\[nodemon\] (?:restarting|starting)|^Restarting API|server restarting/i.test(text)
            ) {
                value.state = 'starting';
                value.missed = 0;
                value.revision++;
            } else if (
                !this.structured.has(app) &&
                app === 'stats' &&
                /^Started Statistics\./.test(text)
            ) {
                value.state = 'running';
            }
            if (
                /\bWARN(?:ING)?\b|\bERROR\b|error TS\d+|Found [1-9]\d* errors|(?:^|\s)[⚠▲]/i.test(
                    text,
                )
            ) {
                value.warningUntil = Date.now() + 30_000;
            }
        }
    }
}

/** A single dimmed status label; OSC-8 hyperlinks and underlines are emitted only on a TTY. */
export function formatDevStatus(
    app: DevApp & { state: DevAppState },
    tty: boolean,
    colors: ChalkInstance = chalkStderr,
): string {
    if (!tty) return app.label;
    let label = app.href ? `\x1b]8;;${app.href}\x1b\\${app.label}\x1b]8;;\x1b\\` : app.label;
    if (app.href) label = colors.underline(label);
    const color =
        app.state === 'running'
            ? colors.green
            : app.state === 'starting'
              ? colors.blue
              : app.state === 'warning'
                ? colors.hex('#ffa500')
                : colors.red;
    return colors.dim(color(label));
}
