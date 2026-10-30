import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReleaseBumpStructures from './bump-structures.js';
import { RunVerbosity } from '../../runtime/command-runner.js';
import { increaseStructuresVersion } from '../../runtime/structures-version.js';

vi.mock('../../runtime/structures-version.js', () => ({
    increaseStructuresVersion: vi.fn(),
}));

describe('ReleaseBumpStructures command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('bumps the structures version at the selected verbosity', async () => {
        const command = new ReleaseBumpStructures([], {} as any);
        (command as any).config = {};
        (command as any).parseWithContext = vi.fn(async () => ({ context: { rootDir: '/repo', verbosity: RunVerbosity.Output }, flags: { force: true, 'dry-run': false } }));

        await command.run();

        expect(increaseStructuresVersion).toHaveBeenCalledExactlyOnceWith({ cwd: '/repo', force: true, dryRun: false, verbosity: RunVerbosity.Output });
    });

    it('exposes the verbosity flags', () => {
        expect(Object.keys(ReleaseBumpStructures.flags).sort()).toEqual(['dry-run', 'force', 'quiet', 'verbose']);
    });
});
