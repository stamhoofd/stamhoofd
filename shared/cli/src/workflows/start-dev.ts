import { hasLogSink, log, markSpanFailed, withSpan } from '@common/opentelemetry-decorators';
import { context as otelContext, propagation } from '@opentelemetry/api';
import { openDevEventChannel } from '../runtime/dev-event-channel.js';
import { DevLifecycle } from '../runtime/dev-lifecycle.js';
import { processError } from '@node/opentelemetry-process';
import { execResult } from '../runtime/process.js';
import { getCliTelemetry, withCliCleanup } from '../runtime/telemetry.js';
import { buildBackendEnv, buildDomains } from '../config/build-config.js';
import { successSymbol } from '../config/shared-service-config.js';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import { join } from 'node:path';
import { backendDevCommand, devToolPath, shellQuote } from '../runtime/dev-commands.js';
import type { DevApp } from '../runtime/dev-status.js';
import { DevStatus, formatDevStatus } from '../runtime/dev-status.js';
import { createLiveOutput } from '../runtime/live-output.js';
import { removeInstanceManifest, writeInstanceManifest } from '../runtime/manifest-store.js';
import { sharedBuildReadyCommand, sharedBuildWatchCommand } from '../runtime/monorepo-runner.js';
import { setActiveOutputTarget } from '../runtime/output-target.js';
import { openUrl } from '../runtime/ux.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import { startServices, stopServices } from '../services/manager.js';
import { sharedServiceDefinitions } from '../services/registry.js';
import { setupDevelopmentS3Buckets } from '../services/s3-buckets.js';
import { sharedServicesRunning } from '../services/shared-services.js';
import { startStripe, stopStripe } from '../services/stripe.js';
import { checkSetup, isSetupReady, printSetupReport } from './setup-machine.js';

const serviceCheckIntervalMs = 5000;

export enum DevTarget {
    All = 'all',
    Instance = 'instance',
    Backend = 'backend',
    Frontend = 'frontend',
    Docs = 'docs',
}

enum PrerequisiteState {
    Ready = 'ready',
    Missing = 'missing',
}

export async function runDev(context: CliContext, target: DevTarget, options: { services: boolean; stripe: boolean; open?: boolean }): Promise<void> {
    let startedServices = false;
    let startedStripe = false;
    let manifestWritten = false;
    const output = createLiveOutput();
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    let servicesState: PrerequisiteState = PrerequisiteState.Ready;
    let servicesCheckInterval: NodeJS.Timeout | undefined;
    let servicesCheckPromise: Promise<void> | undefined;
    let monitoring = false;

    const setStatus = () => {
        const tty = getCliTelemetry()?.terminal.isTTY ?? !!process.stderr.isTTY;
        output.setStatus(status.items().map(app => ({ label: formatDevStatus(app, tty) })));
    };
    const status = new DevStatus(devApps(target, domains, ports), setStatus);
    const lifecycle = new DevLifecycle(event => status.event(event));
    let channel: Awaited<ReturnType<typeof openDevEventChannel>> | undefined;

    const refreshSetupState = (): Promise<boolean> => withSpan('dev.prerequisites', async () => {
        const report = await checkSetup(context);
        const ready = isSetupReady(report);

        if (!ready) {
            markSpanFailed();
            status.fail();
            output.clearStatus();
            printSetupReport(report);
        }

        return ready;
    }, { label: 'Checking development prerequisites' });

    const refreshServicesState = async (): Promise<boolean> => {
        if (!options.services) {
            servicesState = PrerequisiteState.Ready;
            return true;
        }
        if (servicesCheckPromise) {
            await servicesCheckPromise;
            return servicesState === PrerequisiteState.Ready;
        }

        servicesCheckPromise = (async () => {
            try {
                servicesState = await sharedServicesRunning(context)
                    ? PrerequisiteState.Ready
                    : PrerequisiteState.Missing;
            } catch {
                servicesState = PrerequisiteState.Missing;
            } finally {
                if (monitoring && servicesState === PrerequisiteState.Missing) status.warn();
                servicesCheckPromise = undefined;
            }
        })();

        await servicesCheckPromise;
        return servicesState === PrerequisiteState.Ready;
    };

    setActiveOutputTarget(output);

    try {
        setStatus();
        output.log('Starting development session...');
        const setupIsReady = await refreshSetupState();
        if (!setupIsReady) {
            output.log('Resolve the setup issues above, then retry: stam setup');
            return;
        }

        const servicesReady = await withSpan('dev.services', async () => {
            const servicesAreRunning = await refreshServicesState();
            const shouldStartServices = options.services && !servicesAreRunning;
            if (shouldStartServices) {
                try {
                    const result = await startServices(context, sharedServiceDefinitions);
                    startedServices = result.started.length > 0;
                    servicesState = PrerequisiteState.Ready;
                } catch (error) {
                    servicesState = PrerequisiteState.Missing;
                    status.fail();
                    throw error;
                }
            }

            if (!servicesAreRunning && options.services) {
                const servicesReadyAfterStart = await refreshServicesState();
                if (!servicesReadyAfterStart) {
                    output.log('Resolve the shared service issues above, then retry: stam services up');
                    markSpanFailed();
                    status.fail();
                    return false;
                }
            }

            if (options.services && target !== DevTarget.Frontend && target !== DevTarget.Docs) {
                await setupDevelopmentS3Buckets(context);
            }
            return true;
        }, { label: options.services ? 'Preparing shared services' : undefined });
        if (!servicesReady) return;

        await withSpan('dev.routes', async () => {
            await writeInstanceManifest(context, {
                caddy: CaddyService.buildRouteOptions(context),
                domains: {
                    dashboard: domains.dashboard,
                    api: domains.api,
                    renderer: domains.renderer,
                    registration: domains.registration,
                    webshop: domains.webshop,
                },
            });
            manifestWritten = true;

            if (options.services) {
                await CaddyService.reload(context);
            }
        }, { label: 'Configuring local routes' });
        if (options.services) {
            servicesCheckInterval = setInterval(() => {
                void refreshServicesState();
            }, serviceCheckIntervalMs);
        }

        const stripeEnv = options.stripe && target !== DevTarget.Frontend && target !== DevTarget.Docs
            ? await withSpan('dev.stripe', () => startStripe(context), { label: 'Starting Stripe webhook listener' })
            : {};
        startedStripe = Object.keys(stripeEnv).length > 0;

        if (options.open) {
            const openDomain = target === DevTarget.Docs ? domains.docs : domains.dashboard;
            openUrl(`https://${openDomain}`);
            output.log(`${successSymbol} Opened ${target === DevTarget.Docs ? 'docs' : 'dashboard'} in your browser`);
        }
        output.log('Starting app processes...');
        output.log('Press Ctrl+C to stop this session.');

        monitoring = true;
        const carrier: Record<string, string> = {};
        propagation.inject(otelContext.active(), carrier);
        channel = await openDevEventChannel(event => lifecycle.receive(event), carrier.traceparent);
        status.start();
        const names = target === DevTarget.Docs ? 'docs' : target === DevTarget.All ? 'shared,apps,docs' : 'shared,apps';
        const result = await execResult('pnpm', ['exec', 'concurrently', '--names', names, '--prefix', '[{name}]', '--kill-others-on-fail', ...concurrentlyTargets(context.rootDir, target, ports, context.verbose)], {
            cwd: context.rootDir,
            env: {
                ...process.env,
                ...buildBackendEnv(context),
                ...stripeEnv,
                ...channel.env,
                STAM_DEV_VERBOSE: context.verbose ? '1' : '0',
                STAM_DEV_API_INSPECT_PORT: String(ports.apiInspector),
                STAM_DEV_STATS_INSPECT_PORT: String(ports.statsInspector),
                STAM_DEV_RENDERER_INSPECT_PORT: String(ports.rendererInspector),
                ...(!context.verbose ? { PNPM_CONFIG_LOGLEVEL: 'warn', CONSOLA_LEVEL: '1' } : {}),
                FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
                npm_config_color: process.env.npm_config_color ?? 'always',
                npm_config_script_shell: process.env.npm_config_script_shell ?? '/bin/bash',
            },
            label: false,
            output: 'always',
            outputStyle: 'plain',
            processGroup: true,
            // This is a continuous log stream, not bounded diagnostic capture.
            maxDiagnosticChars: Number.MAX_SAFE_INTEGER,
            log: (level, message, fields) => {
                if (fields['diagnostic.kind'] === 'stdout' || fields['diagnostic.kind'] === 'stderr') {
                    status.observe(fields['diagnostic.kind'], message);
                }
                if (hasLogSink()) return log(level, message, fields);
                if (fields['diagnostic.kind'] === 'command') return false;
                output.write(message);
                return true;
            },
        });
        if (result.code !== 0 && result.reason !== 'aborted') throw processError('Development process failed.', 'pnpm concurrently', result);
    } catch (error) {
        if (!getCliTelemetry()?.signal.aborted) status.fail();
        throw error;
    } finally {
        monitoring = false;
        status.stop();
        lifecycle.close();
        if (servicesCheckInterval) clearInterval(servicesCheckInterval);
        try {
            await withCliCleanup(async () => {
                await channel?.close();
                await servicesCheckPromise;
                if (manifestWritten) await removeInstanceManifest(context);
                if (startedStripe) await stopStripe(context);
                if (manifestWritten && options.services) await CaddyService.reload(context);
                if (startedServices) {
                    await stopServices(context, sharedServiceDefinitions);
                    output.log(`${successSymbol} Shared services stopped because this session started them`);
                }
                if (manifestWritten) output.log(`${successSymbol} Development session stopped`);
            });
        } finally {
            output.stop();
            setActiveOutputTarget(undefined);
        }
    }
}

/** Only selected applications appear; short service names still link to their local routes. */
export function devApps(target: DevTarget, domains: ReturnType<typeof buildDomains>, ports: ReturnType<typeof buildPorts>): DevApp[] {
    const frontend = target === DevTarget.All || target === DevTarget.Instance || target === DevTarget.Frontend;
    const backend = target === DevTarget.All || target === DevTarget.Instance || target === DevTarget.Backend;
    const apps: DevApp[] = [];
    if (frontend) apps.push({ id: 'dashboard', label: 'dashboard', href: `https://${domains.dashboard}`, port: ports.webApp });
    if (backend) apps.push({ id: 'api', label: 'api', href: `https://${domains.api}`, port: ports.api });
    if (target === DevTarget.All || target === DevTarget.Docs) apps.push({ id: 'docs', label: 'docs', href: `https://${domains.docs}`, port: ports.docs });
    if (frontend) apps.push({ id: 'webshop', label: 'webshop', href: `https://${domains.webshop}`, port: ports.webshop });
    if (backend) apps.push({ id: 'renderer', label: 'renderer', href: `https://${domains.renderer}`, port: ports.renderer }, { id: 'stats', label: 'stats' });
    return apps;
}

function appCommand(rootDir: string, target: DevTarget): string {
    const apps: { name: string; path: string; command: string }[] = [];
    if (target !== DevTarget.Frontend) {
        for (const app of ['api', 'renderer', 'stats'] as const) {
            apps.push({ name: app, path: `backend/app/${app === 'stats' ? 'statistics-syncer' : app}`, command: backendDevCommand(rootDir, app) });
        }
    }
    if (target !== DevTarget.Backend) {
        for (const app of ['dashboard', 'webshop']) {
            const command = `NODE_ENV=development ENV_FILE=${shellQuote(join(rootDir, 'frontend/.env.json'))} node ${shellQuote(devToolPath(rootDir, 'supervise'))} ${app} vite`;
            apps.push({ name: app, path: `frontend/app/${app === 'dashboard' ? 'web-app' : app}`, command });
        }
    }
    const commands = apps.map(app => `pnpm --dir ${shellQuote(join(rootDir, app.path))} exec sh -c ${shellQuote(app.command)}`);
    return `pnpm exec concurrently --names ${apps.map(app => app.name).join(',')} --prefix '[{name}]' --kill-others-on-fail ${commands.map(shellQuote).join(' ')}`;
}

// `--host 0.0.0.0` is required: Caddy runs in Docker and reaches the dev servers
// through `host.docker.internal`, so the server must listen on all interfaces.
// Nuxt otherwise binds the loopback address only (`::1`), which the Caddy
// container cannot reach, and every request to docs.<instance>.stamhoofd 502s.
function docsCommand(rootDir: string, ports: ReturnType<typeof buildPorts>): string {
    const pnpm = `pnpm --dir ${shellQuote(join(rootDir, 'docs'))}`;
    return `${pnpm} run prepare:observability && ${pnpm} exec node ${shellQuote(devToolPath(rootDir, 'supervise'))} docs nuxt dev --port ${ports.docs} --host 0.0.0.0`;
}

export function commandsForTarget(rootDir: string, target: DevTarget, ports: ReturnType<typeof buildPorts>): string[] {
    if (target === DevTarget.Docs) {
        return [docsCommand(rootDir, ports)];
    }
    if (target === DevTarget.Backend) {
        return [appCommand(rootDir, target)];
    }
    if (target === DevTarget.Frontend) {
        return [appCommand(rootDir, target)];
    }
    if (target === DevTarget.All) {
        return [appCommand(rootDir, target), docsCommand(rootDir, ports)];
    }
    return [appCommand(rootDir, target)];
}

// The docs site does not consume any @stamhoofd/* build output, so it never
// waits for the shared build: a docs-only session skips the watcher entirely,
// and in `all` the docs server starts immediately while the app processes
// wait for the shared build to be ready.
export function concurrentlyTargets(rootDir: string, target: DevTarget, ports: ReturnType<typeof buildPorts>, verbose = false): string[] {
    const commands = commandsForTarget(rootDir, target, ports);
    if (target === DevTarget.Docs) {
        return commands;
    }
    const docs = docsCommand(rootDir, ports);
    return [sharedBuildWatchCommand(verbose), ...commands.map(command => command === docs ? command : `${sharedBuildReadyCommand()} && ${command}`)];
}
