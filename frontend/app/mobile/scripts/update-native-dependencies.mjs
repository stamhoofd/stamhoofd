import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Root postinstall hook for native mobile dependency upgrades. The committed
 * native-dependencies.json records a successful refresh so unchanged installs
 * can run without Xcode. CI uses --check to reject stale state without modifying it.
 * Production-only installs skip the hook; explicit checks still require all dependencies.
 *
 * @typedef {object} NativeDependencyState
 * @property {Record<string, {version: string, path: string}>} dependencies Installed native packages and repository-root-relative real paths.
 * @property {string | null} config Hash of the Capacitor configuration.
 * @property {Record<string, string | null>} generated Hashes of generated manifests; null means a file is missing.
 */

const mobileDir = fileURLToPath(new URL('../', import.meta.url));
const swiftPackage = 'ios/App/CapApp-SPM/Package.swift';
const swiftLock = 'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved';
const generatedFiles = [swiftPackage, swiftLock, 'android/capacitor.settings.gradle', 'android/app/capacitor.build.gradle'];
const runtimePackages = ['@capacitor/core', '@capacitor/ios', '@capacitor/android', '@capacitor/cli'];

/**
 * @param {string} path JSON file to read.
 * @returns {any} Parsed contents; missing files and invalid JSON propagate as errors.
 */
function readJSON(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {string} path File whose contents participate in the refresh check.
 * @returns {string | null} SHA-256 digest, or null when the file is absent.
 */
function hashFile(path) {
    return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
}

/**
 * Capture installed native inputs and generated outputs in a stable order.
 * Real paths detect pnpm dependency-layout changes even when versions match;
 * repository-root-relative paths keep the record portable between checkout locations.
 *
 * @param {string} directory Mobile workspace directory with installed dependencies.
 * @returns {NativeDependencyState} State compared with the last successful refresh.
 */
function dependencyState(directory) {
    const rootDirectory = resolve(directory, '../../..');
    const manifest = readJSON(join(directory, 'package.json'));
    const dependencies = {};
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).sort()) {
        const packagePath = join(directory, 'node_modules', name, 'package.json');
        const installed = readJSON(packagePath);
        if (runtimePackages.includes(name) || installed.capacitor || existsSync(join(dirname(packagePath), 'plugin.xml'))) {
            dependencies[name] = {
                version: installed.version,
                path: relative(rootDirectory, dirname(realpathSync(packagePath))),
            };
        }
    }
    return {
        dependencies,
        config: hashFile(join(directory, 'capacitor.config.json')),
        generated: Object.fromEntries(generatedFiles.map(path => [path, hashFile(join(directory, path))])),
    };
}

/**
 * Run a native tool synchronously, forwarding its output to the install log.
 *
 * @param {string} command Executable resolved through PATH.
 * @param {string[]} args Arguments passed without a shell.
 * @param {string} cwd Working directory.
 * @returns {void}
 * @throws {Error} When spawning fails, the process is signalled, or it exits nonzero.
 */
function runCommand(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.signal ?? result.status}).`);
}

/**
 * Refresh stale native dependencies using Capacitor and Xcode on macOS.
 * Matching state is a no-op on every platform. The success record is written
 * only after both tools succeed and the Capacitor Swift versions agree.
 * Failed refreshes may leave native changes on disk but never record success.
 *
 * @param {object} [options] Execution options; platform and run are injectable for tests.
 * @param {string} [options.directory] Mobile workspace; defaults to this script's parent directory.
 * @param {string} [options.platform] Host platform; defaults to process.platform.
 * @param {boolean} [options.check=false] Reject stale state without running tools or writing files.
 * @param {typeof runCommand} [options.run] Checked synchronous command runner.
 * @returns {void}
 * @throws {Error} When state is stale in check mode or outside macOS, or refreshing fails.
 */
export function updateNativeDependencies({ directory = mobileDir, platform = process.platform, check = false, run = runCommand } = {}) {
    // The pinned pnpm writes JSON here but exposes no production-install environment flag.
    const modulesPath = resolve(directory, '../../../node_modules/.modules.yaml');
    if (!check && existsSync(modulesPath) && readJSON(modulesPath).included?.devDependencies === false) return;

    const statePath = join(directory, 'native-dependencies.json');
    const current = dependencyState(directory);
    if (existsSync(statePath) && JSON.stringify(readJSON(statePath)) === JSON.stringify(current)) return;

    const instructions = 'Run pnpm install on macOS with Xcode, then commit the generated native files and frontend/app/mobile/native-dependencies.json together with the dependency update.';
    if (check || platform !== 'darwin') {
        throw new Error(`Mobile native dependencies are out of sync. ${instructions}`);
    }

    // Verify full Xcode is selected before modifying the native projects.
    run('xcodebuild', ['-version'], directory);
    console.log('Updating mobile native dependencies and resolving Swift packages…');
    // Capacitor update otherwise attempts to copy web assets on a fresh checkout.
    // These are native output directories; app builds still populate them through cap sync.
    mkdirSync(join(directory, 'ios/App/App/public'), { recursive: true });
    mkdirSync(join(directory, 'android/app/src/main/assets/public'), { recursive: true });
    run('pnpm', ['exec', 'cap', 'update'], directory);
    run('xcodebuild', ['-resolvePackageDependencies', '-project', 'ios/App/App.xcodeproj', '-scheme', 'App'], directory);

    const updated = dependencyState(directory);
    const version = updated.dependencies['@capacitor/ios'].version;
    const resolved = readJSON(join(directory, swiftLock));
    if (resolved.pins.find(pin => pin.identity === 'capacitor-swift-pm')?.state.version !== version
        || !readFileSync(join(directory, swiftPackage), 'utf8').includes(`exact: "${version}"`)
        || Object.values(updated.generated).some(hash => hash === null)) {
        throw new Error(`Native dependency refresh did not produce matching Capacitor manifests. ${instructions}`);
    }
    writeFileSync(statePath, `${JSON.stringify(updated, null, 4)}\n`);
    console.log('Mobile native dependencies updated. Commit the generated native files and native-dependencies.json.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        updateNativeDependencies({ check: process.argv.includes('--check') });
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
