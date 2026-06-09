import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CliContext } from "../context/create-context.js";
import {
    registerServiceRoutes,
    RouteManifestKind,
    unregisterServiceRoutes,
} from "../runtime/manifest-store.js";
import { CaddyService } from "../services/definitions/caddy-service.js";
import { startServices, stopServices } from "../services/manager.js";
import { sharedServicesRunning } from "../services/shared-services.js";
import { runSgvMock } from "./start-sgv-mock.js";

vi.mock("node:child_process", () => ({
    spawn: vi.fn(),
}));

vi.mock("../runtime/manifest-store.js", () => ({
    registerServiceRoutes: vi.fn(),
    unregisterServiceRoutes: vi.fn(),
    RouteManifestKind: {
        SgvMock: "sgv-mock",
    },
}));

vi.mock("../services/definitions/caddy-service.js", () => ({
    CaddyService: {
        reload: vi.fn(),
    },
    caddyService: {},
}));

vi.mock("../services/manager.js", () => ({
    startServices: vi.fn(),
    stopServices: vi.fn(),
}));

vi.mock("../services/shared-services.js", () => ({
    sharedServicesRunning: vi.fn(),
}));

const context = {
    rootDir: "/repo",
    generatedDir: "/repo/.development/cli/generated",
    env: "stamhoofd",
    workspace: "main",
    verbose: false,
    instance: {
        name: "main",
        prefix: "",
        primary: true,
        portOffset: 0,
    },
} as CliContext;

describe("runSgvMock", () => {
    let signalHandlers: Partial<Record<NodeJS.Signals, NodeJS.SignalsListener>>;

    beforeEach(() => {
        vi.clearAllMocks();
        signalHandlers = {};
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.spyOn(process, "on").mockImplementation((event, listener) => {
            if (event === "SIGINT" || event === "SIGTERM") {
                signalHandlers[event] = listener as NodeJS.SignalsListener;
            }
            return process;
        });
        vi.spyOn(process, "off").mockImplementation((event, listener) => {
            if (
                (event === "SIGINT" || event === "SIGTERM") &&
                signalHandlers[event] === listener
            ) {
                delete signalHandlers[event];
            }
            return process;
        });
        vi.mocked(sharedServicesRunning).mockResolvedValue(true);
        vi.mocked(registerServiceRoutes).mockResolvedValue(undefined);
        vi.mocked(unregisterServiceRoutes).mockResolvedValue(undefined);
        vi.mocked(CaddyService.reload).mockResolvedValue(undefined);
        vi.mocked(startServices).mockResolvedValue({ env: {}, started: [] });
        vi.mocked(stopServices).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("writes SGV routes to the active manifest before reloading Caddy", async () => {
        const child = createChild();
        vi.mocked(spawn).mockReturnValue(child as any);

        const promise = runSgvMock(context);
        await waitFor(() => signalHandlers.SIGINT !== undefined);

        expect(registerServiceRoutes).toHaveBeenCalledWith(context, {
            name: "main-sgv-mock",
            kind: RouteManifestKind.SgvMock,
            routes: [
                { hosts: ["login.sgv.stamhoofd"], port: 9094 },
                { hosts: ["admin.sgv.stamhoofd"], port: 9094 },
            ],
        });
        expect(CaddyService.reload).toHaveBeenCalledTimes(1);

        signalHandlers.SIGINT?.("SIGINT");

        await expect(promise).resolves.toBeUndefined();
        expect(child.kill).toHaveBeenCalledWith("SIGTERM");
        expect(unregisterServiceRoutes).toHaveBeenCalledWith(
            context,
            "main-sgv-mock",
        );
        expect(CaddyService.reload).toHaveBeenCalledTimes(2);
    });

    it("removes the manifest when the initial Caddy reload fails", async () => {
        vi.mocked(CaddyService.reload).mockRejectedValueOnce(
            new Error("reload failed"),
        );

        await expect(runSgvMock(context)).rejects.toThrow("reload failed");

        expect(registerServiceRoutes).toHaveBeenCalledOnce();
        expect(unregisterServiceRoutes).toHaveBeenCalledWith(
            context,
            "main-sgv-mock",
        );
        expect(spawn).not.toHaveBeenCalled();
    });
});

function createChild(): EventEmitter & { kill: ReturnType<typeof vi.fn> } {
    const child = new EventEmitter() as EventEmitter & {
        kill: ReturnType<typeof vi.fn>;
    };
    child.kill = vi.fn();
    return child;
}

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let i = 0; i < 20; i++) {
        if (predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("Timed out waiting for condition.");
}
