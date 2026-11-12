import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line import-js/no-relative-packages -- Exercise the install hook without adding a reverse workspace dependency.
import { updateNativeDependencies } from '../../../../frontend/app/mobile/scripts/update-native-dependencies.mjs';

const directories: string[] = [];
const swiftLock = 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved';

function write(directory: string, path: string, value: unknown) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), typeof value === 'string' ? value : JSON.stringify(value));
}

function fixture() {
    const rootDirectory = mkdtempSync(join(tmpdir(), 'native-dependencies-'));
    directories.push(rootDirectory);
    const directory = join(rootDirectory, 'frontend/app/mobile');
    write(directory, 'package.json', { dependencies: { '@capacitor/ios': '8.6.0', 'native-plugin': '1.0.0', 'vue': '3.0.0' } });
    write(directory, 'node_modules/@capacitor/ios/package.json', { version: '8.6.0' });
    write(directory, 'node_modules/native-plugin/package.json', { version: '1.0.0', capacitor: { ios: { src: 'ios' } } });
    write(directory, 'node_modules/vue/package.json', { version: '3.0.0' });
    write(directory, 'capacitor.config.json', {});
    write(directory, 'ios/App/CapApp-SPM/Package.swift', 'exact: "8.6.0"');
    write(directory, swiftLock, { pins: [{ identity: 'capacitor-swift-pm', state: { version: '8.6.0' } }] });
    write(directory, 'android/capacitor.settings.gradle', '// generated');
    write(directory, 'android/app/capacitor.build.gradle', '// generated');
    return directory;
}

afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('native dependency install hook', () => {
    function runPostinstall(directory: string) {
        const postinstall = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')).scripts.postinstall;
        // eslint-disable-next-line node-security/no-dynamic-command-string -- Exercise the trusted repository lifecycle command with its actual shell semantics.
        return spawnSync('sh', ['-c', postinstall], { cwd: directory, encoding: 'utf8' });
    }

    it('skips backend-only deployments without the mobile workspace', () => {
        const directory = mkdtempSync(join(tmpdir(), 'native-dependencies-'));
        directories.push(directory);

        const result = runPostinstall(directory);

        expect(result.stderr).toBe('');
        expect(result.status).toBe(0);
    });

    it.each([0, 42])('runs the mobile hook and preserves its exit status (%s)', (status) => {
        const directory = fixture();
        write(directory, 'scripts/update-native-dependencies.mjs', `console.log('mobile hook'); process.exitCode = ${status};`);

        const result = runPostinstall(resolve(directory, '../../..'));

        expect(result.stdout).toBe('mobile hook\n');
        expect(result.status).toBe(status);
    });

    it('fails if the mobile workspace exists but its hook is missing', () => {
        const directory = fixture();
        const result = runPostinstall(resolve(directory, '../../..'));

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('MODULE_NOT_FOUND');
    });

    it('skips production-only installs without reading missing devDependencies or writing native state', () => {
        const directory = fixture();
        write(directory, 'package.json', { devDependencies: { '@capacitor/cli': '8.6.0' } });
        write(resolve(directory, '../../..'), 'node_modules/.modules.yaml', { included: { devDependencies: false } });
        const run = vi.fn();

        expect(() => updateNativeDependencies({ directory, platform: 'darwin', run })).not.toThrow();
        expect(run).not.toHaveBeenCalled();
        expect(() => readFileSync(join(directory, 'native-dependencies.json'))).toThrow();
    });

    it.each([false, true])('rejects missing devDependencies in explicit checks (devDependencies installed: %s)', (devDependencies) => {
        const directory = fixture();
        write(directory, 'package.json', { devDependencies: { '@capacitor/cli': '8.6.0' } });
        write(resolve(directory, '../../..'), 'node_modules/.modules.yaml', { included: { devDependencies } });

        expect(() => updateNativeDependencies({ directory, check: true })).toThrow('ENOENT');
    });

    it('rejects missing devDependencies during full installs', () => {
        const directory = fixture();
        write(directory, 'package.json', { devDependencies: { '@capacitor/cli': '8.6.0' } });
        write(resolve(directory, '../../..'), 'node_modules/.modules.yaml', { included: { devDependencies: true } });

        expect(() => updateNativeDependencies({ directory })).toThrow('ENOENT');
    });

    it('records resolved dependency paths relative to the repository root', () => {
        const directory = fixture();
        const packagePath = 'node_modules/.pnpm/native-plugin@1.0.0/node_modules/native-plugin';
        const installedPath = resolve(directory, '../../..', packagePath);
        write(installedPath, 'package.json', { version: '1.0.0', capacitor: {} });
        rmSync(join(directory, 'node_modules/native-plugin'), { recursive: true });
        symlinkSync(installedPath, join(directory, 'node_modules/native-plugin'), 'dir');

        updateNativeDependencies({ directory, platform: 'darwin', run: vi.fn() });

        const state = JSON.parse(readFileSync(join(directory, 'native-dependencies.json'), 'utf8'));
        expect(state.dependencies['native-plugin'].path).toBe(packagePath);
    });

    it('rejects a pending refresh on Linux before running commands or writing a receipt', () => {
        const directory = fixture();
        const run = vi.fn();
        expect(() => updateNativeDependencies({ directory, platform: 'linux', run })).toThrow('macOS with Xcode');
        expect(run).not.toHaveBeenCalled();
        expect(() => readFileSync(join(directory, 'native-dependencies.json'))).toThrow();
    });

    it('preflights Xcode, updates native dependencies, and resolves Swift before recording success', () => {
        const directory = fixture();
        const run = vi.fn();
        updateNativeDependencies({ directory, platform: 'darwin', run });
        expect(run.mock.calls).toEqual([
            ['xcodebuild', ['-version'], directory],
            ['pnpm', ['exec', 'cap', 'update'], directory],
            ['xcodebuild', ['-resolvePackageDependencies', '-project', 'ios/App/App.xcodeproj', '-scheme', 'App'], directory],
        ]);
        run.mockClear();
        updateNativeDependencies({ directory, platform: 'linux', run });
        updateNativeDependencies({ directory, check: true, run });
        expect(run).not.toHaveBeenCalled();
    });

    it.each(['plugin', 'removed-plugin', 'swift-lock', 'config'])('detects a changed %s even with a previous successful receipt', (change) => {
        const directory = fixture();
        updateNativeDependencies({ directory, platform: 'darwin', run: vi.fn() });
        if (change === 'plugin') write(directory, 'node_modules/native-plugin/package.json', { version: '1.1.0', capacitor: {} });
        if (change === 'removed-plugin') write(directory, 'package.json', { dependencies: { '@capacitor/ios': '8.6.0' } });
        if (change === 'swift-lock') write(directory, swiftLock, { pins: [] });
        if (change === 'config') write(directory, 'capacitor.config.json', { includePlugins: [] });
        const run = vi.fn();
        expect(() => updateNativeDependencies({ directory, platform: 'darwin', check: true, run })).toThrow('out of sync');
        expect(run).not.toHaveBeenCalled();
    });

    it('does not require macOS for an unrelated web dependency upgrade', () => {
        const directory = fixture();
        updateNativeDependencies({ directory, platform: 'darwin', run: vi.fn() });
        write(directory, 'node_modules/vue/package.json', { version: '3.1.0' });
        expect(() => updateNativeDependencies({ directory, platform: 'linux', run: vi.fn() })).not.toThrow();
    });

    it.each([1, 2, 3])('does not record success when command %s fails', (failure) => {
        const directory = fixture();
        let calls = 0;
        const run = vi.fn(() => {
            if (++calls === failure) throw new Error('command failed');
        });
        expect(() => updateNativeDependencies({ directory, platform: 'darwin', run })).toThrow('command failed');
        expect(run).toHaveBeenCalledTimes(failure);
        expect(() => readFileSync(join(directory, 'native-dependencies.json'))).toThrow();
    });

    it('rejects a successful resolver that leaves a stale Capacitor pin', () => {
        const directory = fixture();
        write(directory, swiftLock, { pins: [{ identity: 'capacitor-swift-pm', state: { version: '8.4.2' } }] });
        expect(() => updateNativeDependencies({ directory, platform: 'darwin', run: vi.fn() })).toThrow('matching Capacitor manifests');
        expect(() => readFileSync(join(directory, 'native-dependencies.json'))).toThrow();
    });
});
