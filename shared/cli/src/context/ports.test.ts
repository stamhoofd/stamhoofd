import { afterEach, describe, expect, it } from 'vitest';
import type { CliContext } from './create-context.js';
import { buildPorts } from './ports.js';

describe('buildPorts', () => {
    afterEach(() => {
        delete process.env.MYSQL_PORT;
    });

    it('uses 3307 as default MySQL host port', () => {
        expect(buildPorts(context()).mysql).toBe(3307);
    });

    it('keeps MYSQL_PORT override support', () => {
        process.env.MYSQL_PORT = '3310';

        expect(buildPorts(context()).mysql).toBe(3310);
    });
});

function context(): CliContext {
    return {
        rootDir: '/tmp/stamhoofd',
        generatedDir: '/tmp/stamhoofd/.development/cli/generated',
        env: 'stamhoofd',
        workspace: 'main',
        verbose: false,
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
