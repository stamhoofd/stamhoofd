import { spawn } from "node:child_process";
import type { CliContext } from "../context/create-context.js";
import { buildDomains } from "../config/build-config.js";
import { buildPorts } from "../context/ports.js";
import { CaddyService } from "../services/definitions/caddy-service.js";
import { sharedServiceDefinitions } from "../services/registry.js";
import { startServices, stopServices } from "../services/manager.js";
import { sharedServicesRunning } from "../services/shared-services.js";
import {
    sharedBuildReadyCommand,
    sharedBuildWatchCommand,
} from "../runtime/monorepo-runner.js";
import {
    registerServiceRoutes,
    RouteManifestKind,
    unregisterServiceRoutes,
} from "../runtime/manifest-store.js";

/** Starts shared dependencies, publishes SGV mock routes through Caddy, and cleans everything up when the session stops. */
export async function runSgvMock(context: CliContext): Promise<void> {
    let startedServices = false;
    const domains = buildDomains(context);
    const ports = buildPorts(context);

    if (!(await sharedServicesRunning(context))) {
        const result = await startServices(context, sharedServiceDefinitions);
        startedServices = result.started.length > 0;
    }

    const routeManifestName = `${context.instance.name}-sgv-mock`;
    await registerServiceRoutes(context, {
        name: routeManifestName,
        kind: RouteManifestKind.SgvMock,
        routes: [
            { hosts: [domains.loginSgv], port: ports.sgvMock },
            { hosts: [domains.adminSgv], port: ports.sgvMock },
        ],
    });
    try {
        await CaddyService.reload(context);
    } catch (error) {
        await unregisterServiceRoutes(context, routeManifestName);
        throw error;
    }

    console.log("Starting SGV mock...");
    console.log(`Login: https://${domains.loginSgv}`);
    console.log(`Admin: https://${domains.adminSgv}`);
    console.log("Press Ctrl+C to stop this session.");

    const child = spawn(
        "yarn",
        [
            "-s",
            "concurrently",
            "-r",
            sharedBuildWatchCommand(),
            `${sharedBuildReadyCommand()} && yarn --cwd backend/app/sgv-mock -s dev`,
        ],
        {
            cwd: context.rootDir,
            env: {
                ...process.env,
                PORT: String(ports.sgvMock),
                STAMHOOFD_PORT: String(ports.sgvMock),
                FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
                npm_config_color: process.env.npm_config_color ?? "always",
                npm_config_script_shell:
                    process.env.npm_config_script_shell ?? "/bin/bash",
            },
            stdio: "inherit",
            shell: false,
        },
    );

    await new Promise<void>((resolve, reject) => {
        let stopping = false;
        let settled = false;
        const settle = (error?: unknown) => {
            if (settled) {
                return;
            }
            settled = true;
            process.off("SIGINT", signalHandler);
            process.off("SIGTERM", signalHandler);
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        };
        const stopSession = async () => {
            if (stopping) {
                return;
            }
            stopping = true;
            child.kill("SIGTERM");
            await unregisterServiceRoutes(context, routeManifestName);
            await CaddyService.reload(context);
            if (startedServices) {
                await stopServices(context, sharedServiceDefinitions);
            }
        };
        const signalHandler = () => {
            void stopSession().then(() => settle(), settle);
        };

        process.on("SIGINT", signalHandler);
        process.on("SIGTERM", signalHandler);
        child.on("error", settle);
        child.on("exit", (code) => {
            void (async () => {
                const wasStopping = stopping;
                await stopSession();
                if (code && code !== 0 && !wasStopping) {
                    settle(
                        new Error(
                            `SGV mock process exited with status ${code}`,
                        ),
                    );
                    return;
                }
                settle();
            })().catch(settle);
        });
    });
}
