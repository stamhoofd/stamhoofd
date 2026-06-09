import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { buildBackendEnv, buildDomains } from '../config/build-config.js';
import { successSymbol } from '../config/shared-service-config.js';
import type { CliContext } from '../context/create-context.js';
import type { StatusItem } from '../runtime/live-output.js';
import { createLiveOutput } from '../runtime/live-output.js';
import { removeInstanceManifest, writeInstanceManifest } from '../runtime/manifest-store.js';
import { sharedBuildReadyCommand, sharedBuildWatchCommand } from '../runtime/monorepo-runner.js';
import { OutputStream, setActiveOutputTarget } from '../runtime/output-target.js';
import { openUrl } from '../runtime/ux.js';
import { CaddyService } from '../services/definitions/caddy-service.js';
import { startServices, stopServices } from '../services/manager.js';
import { sharedServiceDefinitions } from '../services/registry.js';
import { sharedServicesRunning } from '../services/shared-services.js';
import { startStripe, stopStripe } from '../services/stripe.js';
import { checkSetup, isSetupReady, printSetupReport } from './setup-machine.js';

const forceShutdownGraceMs = 750;
const serviceCheckIntervalMs = 5000;

class ForcedShutdownError extends Error {
    constructor(readonly exitCode: number) {
        super('Forced shutdown. Cleanup may be incomplete.');
    }
}

export enum DevTarget {
    All = 'all',
    Instance = 'instance',
    Backend = 'backend',
    Frontend = 'frontend',
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
    const output = createLiveOutput();
    const domains = buildDomains(context);
    let setupState: PrerequisiteState = PrerequisiteState.Ready;
    let servicesState: PrerequisiteState = PrerequisiteState.Ready;
    let servicesCheckInterval: NodeJS.Timeout | undefined;
    let servicesCheckPromise: Promise<void> | undefined;

    const setStatus = () => {
        output.setStatus(buildStatusItems(domains, context.env, setupState, servicesState));
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

        if (options.services) {
            await CaddyService.reload(context);
            servicesCheckInterval = setInterval(() => {
                void refreshServicesState();
            }, serviceCheckIntervalMs);
        }

        const stripeEnv = options.stripe && target !== DevTarget.Frontend
            ? await startStripe(context)
            : {};
        startedStripe = Object.keys(stripeEnv).length > 0;

        if (options.open) {
            openUrl(`https://${domains.dashboard}`);
            output.log(`${successSymbol} Opened dashboard in your browser`);
        }
        output.log('Starting app processes...');
        output.log('Press Ctrl+C to stop this session.');

        const command = commandForTarget(target);
        const child = spawn('yarn', ['-s', 'concurrently', '-r', sharedBuildWatchCommand(), `${sharedBuildReadyCommand()} && ${command}`], {
            cwd: context.rootDir,
            env: {
                ...process.env,
                ...buildBackendEnv(context),
                ...stripeEnv,
                FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
                npm_config_color: process.env.npm_config_color ?? 'always',
                npm_config_script_shell: process.env.npm_config_script_shell ?? '/bin/bash',
            },
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: false,
        });

        child.stdout?.on('data', (chunk: string | Buffer) => output.write(chunk, OutputStream.Stdout));
        child.stderr?.on('data', (chunk: string | Buffer) => output.write(chunk, OutputStream.Stderr));

        await new Promise<void>((resolve, reject) => {
            let stopping = false;
            let forceShutdownArmed = false;
            let forceShutdownTimer: NodeJS.Timeout | undefined;
            let cleanupPromise: Promise<void> | undefined;
            let settled = false;
            const resolveOnce = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };
            const rejectOnce = (error: unknown) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(error);
            };
            const stopSession = async () => {
                if (cleanupPromise) {
                    await cleanupPromise;
                    return;
                }
                cleanupPromise = (async () => {
                    try {
                        child.kill('SIGTERM');
                        if (servicesCheckInterval) {
                            clearInterval(servicesCheckInterval);
                        }
                        await removeInstanceManifest(context);
                        if (startedStripe) {
                            await stopStripe(context);
                        }
                        if (options.services) {
                            await CaddyService.reload(context);
                        }
                        if (startedServices) {
                            await stopServices(context, sharedServiceDefinitions);
                            output.stop({ persistStatus: true });
                            output.log(`${successSymbol} Shared services stopped because this session started them`);
                        } else {
                            output.stop({ persistStatus: true });
                        }
                        output.log(`${successSymbol} Development session stopped`);
                    } finally {
                        if (forceShutdownTimer) {
                            clearTimeout(forceShutdownTimer);
                        }
                        process.off('SIGINT', signalHandler);
                        process.off('SIGTERM', signalHandler);
                    }
                })();

                await cleanupPromise;
            };
            const signalHandler = (signal: NodeJS.Signals) => {
                if (stopping) {
                    if (!forceShutdownArmed) {
                        return;
                    }
                    // The first duplicate signal window is ignored because pnpm can
                    // forward Ctrl+C more than once. After that grace period, a
                    // second signal means the user wants an immediate shutdown.
                    output.clearStatus();
                    output.log('! Forced shutdown. Cleanup may be incomplete.');
                    child.kill('SIGKILL');
                    rejectOnce(new ForcedShutdownError(signal === 'SIGTERM' ? 143 : 130));
                    return;
                }
                stopping = true;
                // pnpm can deliver the initial Ctrl+C twice: once from the terminal
                // process group and once via its own signal forwarding. Only arm the
                // forced-exit shortcut after that duplicate signal window has passed.
                forceShutdownTimer = setTimeout(() => {
                    forceShutdownArmed = true;
                }, forceShutdownGraceMs);
                void stopSession().then(resolveOnce, rejectOnce);
            };
            process.on('SIGINT', signalHandler);
            process.on('SIGTERM', signalHandler);
            child.on('error', rejectOnce);
            child.on('exit', (code) => {
                void (async () => {
                    try {
                        await stopSession();
                        if (stopping) {
                            resolveOnce();
                            return;
                        }
                        if (code && code !== 0) {
                            rejectOnce(new Error(`Development process exited with status ${code}`));
                            return;
                        }
                        resolveOnce();
                    } catch (error) {
                        rejectOnce(error);
                    }
                })();
            });
        });
    } finally {
        setActiveOutputTarget(undefined);
    }
}

function buildStatusItems(domains: ReturnType<typeof buildDomains>, env: string, setupState: PrerequisiteState, servicesState: PrerequisiteState): StatusItem[] {
    return [
        buildDomainStatusItem(domains.dashboard, env),
        buildDomainStatusItem(domains.api, env),
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

function commandForTarget(target: DevTarget): string {
    if (target === DevTarget.Backend) {
        return 'yarn -s lerna run dev --scope @stamhoofd/backend --scope @stamhoofd/backend-renderer --parallel --stream';
    }
    if (target === DevTarget.Frontend) {
        return 'yarn -s lerna run dev --scope @stamhoofd/dashboard --scope @stamhoofd/registration --scope @stamhoofd/auto --scope @stamhoofd/admin --scope @stamhoofd/verify-email --scope @stamhoofd/web-app --scope @stamhoofd/webshop --parallel --stream';
    }
    return 'yarn -s lerna run dev --scope @stamhoofd/backend --scope @stamhoofd/backend-renderer --scope @stamhoofd/dashboard --scope @stamhoofd/registration --scope @stamhoofd/auto --scope @stamhoofd/admin --scope @stamhoofd/verify-email --scope @stamhoofd/web-app --scope @stamhoofd/webshop --parallel --stream';
}
