import { beforeEach, describe, expect, it, vi } from 'vitest';
import SsoStart from './start.js';
import { CaddyService } from '../../services/definitions/caddy-service.js';
import { ssoService } from '../../services/definitions/sso-service.js';
import { allRunning, startServices } from '../../services/manager.js';
import { sharedServiceDefinitions } from '../../services/registry.js';

vi.mock('../../services/definitions/caddy-service.js', () => ({
    CaddyService: { reload: vi.fn() },
    caddyService: {},
}));

vi.mock('../../services/definitions/sso-service.js', () => ({
    ssoService: { start: vi.fn() },
}));

vi.mock('../../services/manager.js', () => ({
    allRunning: vi.fn(),
    startServices: vi.fn(),
}));

describe('SsoStart command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(allRunning).mockResolvedValue(true);
    });

    it('prints local SSO settings before starting SSO', async () => {
        const redirectUri = 'https://example.api.stamhoofd/openid/callback';
        const command = createCommand({ args: { redirectUri }, flags: { background: false } });
        const log = vi.spyOn(command, 'log').mockImplementation(() => undefined);

        await command.run();

        expect(log).toHaveBeenCalledWith(expect.stringContaining('Local SSO settings:'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`Redirect URI:  ${redirectUri}`));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Client secret: stamhoofd-local-secret'));
        expect(CaddyService.reload).toHaveBeenCalledWith(createContext());
        expect(ssoService.start).toHaveBeenCalledWith(createContext(), { redirectUri, background: false });
    });

    it('starts shared services first when they are not running', async () => {
        vi.mocked(allRunning).mockResolvedValue(false);
        const redirectUri = 'https://example.api.stamhoofd/openid/callback';
        const command = createCommand({ args: { redirectUri }, flags: { background: true } });
        vi.spyOn(command, 'log').mockImplementation(() => undefined);

        await command.run();

        expect(startServices).toHaveBeenCalledWith(createContext(), sharedServiceDefinitions);
        expect(ssoService.start).toHaveBeenCalledWith(createContext(), { redirectUri, background: true });
    });
});

function createCommand(parseResult: { args: { redirectUri: string }; flags: { background: boolean } }): SsoStart {
    const command = new SsoStart([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => createContext());
    return command;
}

function createContext() {
    return {
        env: 'stamhoofd',
        rootDir: '/repo',
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    };
}
