import { beforeEach, describe, expect, it, vi } from 'vitest';
import Status from './status.js';
import { listActiveInstanceManifests } from '../runtime/manifest-store.js';
import { printSharedServicesStatus } from '../services/shared-services.js';
import { checkNodeVersion, printNodeVersionStatus } from '../workflows/setup-node.js';

vi.mock('../runtime/manifest-store.js', () => ({
    listActiveInstanceManifests: vi.fn(async () => []),
}));

vi.mock('../services/shared-services.js', () => ({
    printSharedServicesStatus: vi.fn(),
}));

vi.mock('../workflows/setup-node.js', () => ({
    checkNodeVersion: vi.fn(async () => ({ ok: true })),
    printNodeVersionStatus: vi.fn(),
}));

describe('Status command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates context with verbose only', async () => {
        const command = new Status([], {} as any);
        const createContext = vi.fn(async () => ({
            rootDir: '/repo',
            generatedDir: '/repo/.development/cli/generated',
            env: 'stamhoofd',
            workspace: 'main',
            verbose: true,
            instance: {
                name: 'stamhoofd',
                prefix: '',
                primary: true,
                portOffset: 0,
            },
        }));

        (command as any).config = {};
        (command as any).parse = vi.fn(async () => ({ flags: { current: false, watch: false, verbose: true } }));
        (command as any).createContext = createContext;

        await command.run();

        expect(checkNodeVersion).toHaveBeenCalled();
        expect(printNodeVersionStatus).toHaveBeenCalled();
        expect(createContext).toHaveBeenCalledWith({ verbose: true });
        expect(printSharedServicesStatus).toHaveBeenCalled();
        expect(listActiveInstanceManifests).toHaveBeenCalled();
    });
});
