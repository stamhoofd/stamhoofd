import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { caddyDataDir, caddyRootCaPath } from './shared-service-config.js';

describe('Caddy data directory', () => {
    const platform = process.platform;

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: platform, configurable: true });
        vi.unstubAllEnvs();
    });

    it('uses XDG_DATA_HOME on macOS when configured', () => {
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
        vi.stubEnv('XDG_DATA_HOME', path.join(os.homedir(), '.local/share'));

        expect(caddyDataDir()).toBe(path.join(os.homedir(), '.local/share/caddy'));
        expect(caddyRootCaPath()).toBe(path.join(os.homedir(), '.local/share/caddy/pki/authorities/local/root.crt'));
    });

    it('falls back to Application Support on macOS without XDG_DATA_HOME', () => {
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
        vi.stubEnv('XDG_DATA_HOME', '');

        expect(caddyDataDir()).toBe(path.join(os.homedir(), 'Library/Application Support/Caddy'));
    });
});
