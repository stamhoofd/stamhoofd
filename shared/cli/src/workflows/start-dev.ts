import chalk from 'chalk';
import { processError } from '@node/opentelemetry-process';
import { execResult } from '../runtime/process.js';
import { withCliCleanup } from '../runtime/telemetry.js';
import { buildBackendEnv, buildDomains } from '../config/build-config.js';
import { successSymbol } from '../config/shared-service-config.js';
import type { CliContext } from '../context/create-context.js';
import { buildPorts } from '../context/ports.js';
import type { StatusItem } from '../runtime/live-output.js';
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

enum MissingPrerequisite {
    Setup = 'setup',
    Services = 'services',
}

export async function runDev(context: CliContext, target: DevTarget, options: { services: boolean; stripe: boolean; open?: boolean }): Promise<void> {
    let startedServices = false;
    let startedStripe = false;
    let manifestWritten = false;
    const output = createLiveOutput();
    const domains = buildDomains(context);
    const ports = buildPorts(context);
    let setupState: PrerequisiteState = PrerequisiteState.Ready;
    let servicesState: PrerequisiteState = PrerequisiteState.Ready;
    let servicesCheckInterval: NodeJS.Timeout | undefined;
    let servicesCheckPromise: Promise<void> | undefined;

    const setStatus = () => {
        output.setStatus(buildStatusItems(domains, context.env, setupState, servicesState, target));
    };

    const refreshSetupState = async (): Promise<boolean> => {
        const report = await checkSetup(context);
        const ready = isSetupReady(report);

        setupState = ready ? PrerequisiteState.Ready : PrerequisiteState.Missing;
        setStatus();

        if (!ready) {
            output.clearStatus();
            printSetupReport(report);
        }

        return ready;
    };

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
                setStatus();
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

        const servicesAreRunning = await refreshServicesState();
        const shouldStartServices = options.services && !servicesAreRunning;
        if (shouldStartServices) {
            try {
                const result = await startServices(context, sharedServiceDefinitions);
                startedServices = result.started.length > 0;
                servicesState = PrerequisiteState.Ready;
                setStatus();
            } catch (error) {
                servicesState = PrerequisiteState.Missing;
                setStatus();
                throw error;
            }
        }

        if (!servicesAreRunning && options.services) {
            const servicesReadyAfterStart = await refreshServicesState();
            if (!servicesReadyAfterStart) {
                output.log('Resolve the shared service issues above, then retry: stam services up');
                return;
            }
        }

        if (options.services && target !== DevTarget.Frontend && target !== DevTarget.Docs) {
            await setupDevelopmentS3Buckets(context);
        }

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
            servicesCheckInterval = setInterval(() => {
                void refreshServicesState();
            }, serviceCheckIntervalMs);
        }

        const stripeEnv = options.stripe && target !== DevTarget.Frontend && target !== DevTarget.Docs
            ? await startStripe(context)
            : {};
        startedStripe = Object.keys(stripeEnv).length > 0;

        if (startedStripe) {
            output.log('Stripe Webook Listener started');
        }

        if (options.open) {
            const openDomain = target === DevTarget.Docs ? domains.docs : domains.dashboard;
            openUrl(`https://${openDomain}`);
            output.log(`${successSymbol} Opened ${target === DevTarget.Docs ? 'docs' : 'dashboard'} in your browser`);
        }
        output.log('Starting app processes...');
        output.log('Press Ctrl+C to stop this session.');

        const result = await execResult('pnpm', ['exec', 'concurrently', '-r', ...concurrentlyTargets(target, ports)], {
            cwd: context.rootDir,
            env: {
                ...process.env,
                ...buildBackendEnv(context),
                ...stripeEnv,
                FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
                npm_config_color: process.env.npm_config_color ?? 'always',
                npm_config_script_shell: process.env.npm_config_script_shell ?? '/bin/bash',
            },
            label: 'Running development applications',
            output: 'always',
            processGroup: true,
            // This is a continuous log stream, not bounded diagnostic capture.
            maxDiagnosticChars: Number.MAX_SAFE_INTEGER,
        });
        if (result.code !== 0 && result.reason !== 'aborted') throw processError('Development process failed.', 'pnpm concurrently', result);
    } finally {
        if (servicesCheckInterval) clearInterval(servicesCheckInterval);
        try {
            await withCliCleanup(async () => {
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
            output.stop({ persistStatus: true });
            setActiveOutputTarget(undefined);
        }
    }
}

function buildStatusItems(domains: ReturnType<typeof buildDomains>, env: string, setupState: PrerequisiteState, servicesState: PrerequisiteState, target: DevTarget): StatusItem[] {
    const domainItems = target === DevTarget.Docs
        ? [buildDomainStatusItem(domains.docs, env)]
        : [
                buildDomainStatusItem(domains.dashboard, env),
                buildDomainStatusItem(domains.api, env),
                ...(target === DevTarget.All ? [buildDomainStatusItem(domains.docs, env)] : []),
            ];

    return [
        ...domainItems,
        buildMissingPrerequisiteItem(MissingPrerequisite.Setup, setupState),
        buildMissingPrerequisiteItem(MissingPrerequisite.Services, servicesState),
    ].filter((item): item is StatusItem => item !== undefined);
}

function buildMissingPrerequisiteItem(label: MissingPrerequisite, state: PrerequisiteState): StatusItem | undefined {
    if (state !== PrerequisiteState.Missing) {
        return undefined;
    }
    return { label: chalk.bold.red(`! ${label}`) };
}

function buildDomainStatusItem(domain: string, env: string): StatusItem {
    return {
        label: formatDomainLabel(domain, env),
        href: `https://${domain}`,
    };
}

function formatDomainLabel(domain: string, env: string): string {
    const [serviceLabel, ...rest] = domain.split('.');
    const segments = rest;
    const prefix = chalk.dim(`https://${serviceLabel}.`);

    if (segments.length <= 1) {
        return `${prefix}${chalk.dim(segments.join('.'))}`;
    }

    const environmentIndex = env === 'stamhoofd' ? -1 : segments.indexOf(env);
    const highlightIndex = environmentIndex >= 0 ? environmentIndex + 1 : segments.length - 2;
    if (highlightIndex >= segments.length - 1) {
        return `${prefix}${segments.map((segment, index) => index === environmentIndex ? chalk.bold.yellow(segment) : chalk.dim(segment)).join(chalk.dim('.'))}`;
    }
    const environmentSegment = environmentIndex >= 0 ? segments[environmentIndex] : undefined;
    const highlightedSegment = segments[highlightIndex];
    const leading = environmentSegment ? segments.slice(0, environmentIndex).join('.') : segments.slice(0, highlightIndex).join('.');
    const between = environmentSegment ? segments.slice(environmentIndex + 1, highlightIndex).join('.') : '';
    const trailing = segments.slice(highlightIndex + 1).join('.');
    const parts = [prefix];

    if (leading) {
        parts.push(chalk.dim(`${leading}.`));
    }

    if (environmentSegment) {
        parts.push(chalk.bold.yellow(environmentSegment));
        parts.push(chalk.dim('.'));
        if (between) {
            parts.push(chalk.dim(`${between}.`));
        }
    }
    parts.push(chalk.bold.cyan(highlightedSegment));

    if (trailing) {
        parts.push(chalk.dim(`.${trailing}`));
    }

    return parts.join('');
}

const backendCommand = 'pnpm exec turbo run dev --env-mode=loose --filter=@stamhoofd/backend --filter=@stamhoofd/backend-renderer --filter=@stamhoofd/backend-statistics-syncer';
const frontendCommand = 'pnpm exec turbo run dev --env-mode=loose --filter=@stamhoofd/web-app --filter=@stamhoofd/webshop';
const fullStackCommand = 'pnpm exec turbo run dev --env-mode=loose --filter=@stamhoofd/backend --filter=@stamhoofd/backend-renderer --filter=@stamhoofd/backend-statistics-syncer --filter=@stamhoofd/web-app --filter=@stamhoofd/webshop';

// `--host 0.0.0.0` is required: Caddy runs in Docker and reaches the dev servers
// through `host.docker.internal`, so the server must listen on all interfaces.
// Nuxt otherwise binds the loopback address only (`::1`), which the Caddy
// container cannot reach, and every request to docs.<instance>.stamhoofd 502s.
function docsCommand(ports: ReturnType<typeof buildPorts>): string {
    return `pnpm --dir docs run dev --port ${ports.docs} --host 0.0.0.0`;
}

export function commandsForTarget(target: DevTarget, ports: ReturnType<typeof buildPorts>): string[] {
    if (target === DevTarget.Docs) {
        return [docsCommand(ports)];
    }
    if (target === DevTarget.Backend) {
        return [backendCommand];
    }
    if (target === DevTarget.Frontend) {
        return [frontendCommand];
    }
    if (target === DevTarget.All) {
        return [fullStackCommand, docsCommand(ports)];
    }
    return [fullStackCommand];
}

// The docs site does not consume any @stamhoofd/* build output, so it never
// waits for the shared build: a docs-only session skips the watcher entirely,
// and in `all` the docs server starts immediately while the app processes
// wait for the shared build to be ready.
export function concurrentlyTargets(target: DevTarget, ports: ReturnType<typeof buildPorts>): string[] {
    const commands = commandsForTarget(target, ports);
    if (target === DevTarget.Docs) {
        return commands;
    }
    const docs = docsCommand(ports);
    return [sharedBuildWatchCommand(), ...commands.map(command => command === docs ? command : `${sharedBuildReadyCommand()} && ${command}`)];
}
