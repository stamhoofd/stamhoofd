import path from 'node:path';
import { resolvePrimaryInstance, resolvePrimaryWorkspaceRoot, resolveWorkspaceName } from './workspace.js';
import { buildInstance } from './instance.js';
import { getProjectPath } from './project-path.js';
import { resolvePortOffset } from './port-allocation.js';

export type CliContext = {
    rootDir: string;
    generatedDir: string;
    env: string;
    workspace: string;
    verbose: boolean;
    instance: {
        name: string;
        prefix: string;
        primary: boolean;
        portOffset: number;
    };
};

export async function createContext(options: { env: string; instanceName?: string; verbose: boolean }): Promise<CliContext> {
    const rootDir = path.resolve(getProjectPath());
    const workspace = await resolveWorkspaceName(rootDir);
    const workspaceRoot = await resolvePrimaryWorkspaceRoot(rootDir);
    const primary = await resolvePrimaryInstance(rootDir);
    const instance = buildInstance({
        env: options.env,
        workspace,
        primary,
        overrideName: options.instanceName,
    });

    return await resolvePortOffset({
        rootDir,
        generatedDir: path.join(workspaceRoot ?? rootDir, '.development/cli/generated'),
        env: options.env,
        workspace,
        verbose: options.verbose,
        instance,
    });
}
