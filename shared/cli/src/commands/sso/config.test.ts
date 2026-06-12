import { beforeEach, describe, expect, it, vi } from 'vitest';
import SsoConfig from './config.js';

describe('SsoConfig command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prints local SSO settings with the redirect URI placeholder', async () => {
        const command = createCommand({ args: { redirectUri: undefined }, flags: {} });
        const log = vi.spyOn(command, 'log').mockImplementation(() => undefined);

        await command.run();

        expect(log).toHaveBeenCalledWith(expect.stringContaining('Local SSO settings:'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Issuer:        https://sso.stamhoofd/dex/realms/stamhoofd'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Client ID:     stamhoofd-local'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Client secret: stamhoofd-local-secret'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Redirect URI:  https://<organization-id>.api.stamhoofd/openid/callback'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('Email:         sso@example.com'));
        expect(log).toHaveBeenCalledWith(expect.stringContaining('URL:           https://sso.stamhoofd/dex/admin'));
    });

    it('prints local SSO settings with the provided redirect URI', async () => {
        const redirectUri = 'https://example.api.stamhoofd/openid/callback';
        const command = createCommand({ args: { redirectUri }, flags: {} });
        const log = vi.spyOn(command, 'log').mockImplementation(() => undefined);

        await command.run();

        expect(log).toHaveBeenCalledWith(expect.stringContaining(`Redirect URI:  ${redirectUri}`));
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`stam sso start "${redirectUri}"`));
    });
});

function createCommand(parseResult: { args: { redirectUri: string | undefined }; flags: Record<string, unknown> }): SsoConfig {
    const command = new SsoConfig([], {} as any);
    (command as any).config = {};
    (command as any).parse = vi.fn(async () => parseResult);
    (command as any).createContext = vi.fn(async () => ({
        env: 'stamhoofd',
        rootDir: '/repo',
        instance: {
            name: 'stamhoofd',
            prefix: '',
            primary: true,
            portOffset: 0,
        },
    }));
    return command;
}
