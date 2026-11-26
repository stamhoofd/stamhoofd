import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, statSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Owns the final emitted JS coordinates. Maps never belong in web, Capacitor or OTA distribution. */
export function exceptionArtifacts(options: { privateRoot: string; release: string; upload?: boolean }): Plugin {
    const buildNonce = randomUUID();
    let privateDir: string;
    let publicDir: string;
    return {
        name: 'stam-private-exception-artifacts',
        apply: 'build',
        enforce: 'post',
        config: () => ({ build: { sourcemap: 'hidden', rolldownOptions: { output: { sourcemapDebugIds: true } } } }),
        configResolved(config) {
            if (!path.isAbsolute(options.privateRoot)) throw new Error('Invalid exception artifact configuration');
            const root = realpathSync(options.privateRoot);
            publicDir = path.resolve(config.root, config.build.outDir);
            // Require an existing private root outside the repository and every published directory.
            for (const forbidden of [path.resolve(import.meta.dirname, '../../..'), realpathSync(config.root), publicDir]) {
                if (root === forbidden || root.startsWith(forbidden + path.sep)) throw new Error('Exception artifacts require a private directory outside the build tree');
            }
            if ((statSync(root).mode & 0o077) !== 0) throw new Error('Exception artifact directory must be owner-only');
            privateDir = mkdtempSync(path.join(root, 'release-'));
        },
        augmentChunkHash: () => buildNonce,
        generateBundle: {
            order: 'post',
            handler(_, bundle) {
                const owned: { file: string; id: string; lengths: number[] }[] = [];
                for (const item of Object.values(bundle)) {
                    if (item.type !== 'chunk') continue;
                    // Rolldown can emit empty or generated runtime chunks with no source mapping.
                    if (!item.map) continue;
                    const id = item.map.debugId;
                    if (!id) throw new Error('Missing bundler debug ID for ' + item.fileName);
                    owned.push({ file: item.fileName, id, lengths: item.code.split('\n').map(line => line.length) });
                    writeFileSync(path.join(privateDir, `${id}.js.map`), JSON.stringify({ ...JSON.parse(item.map.toString()), file: `${id}.js`, debug_id: id }), { mode: 0o600 });
                    item.map = null;
                }
                if (!owned.length) throw new Error('No private JavaScript source maps');
                const ids = new Map(owned.map(a => [a.file, a.id]));
                for (const chunk of Object.values(bundle)) {
                    if (chunk.type !== 'chunk') continue;
                    const file = chunk.fileName;
                    // Append only: the generated coordinates in the map stay unchanged. Only the
                    // lookup's module gets a table, with module-local bindings, not window state.
                    if (chunk.code.includes('__STAM_OWNED_EXCEPTION_ARTIFACT__')) {
                        const rows = owned.map(a => [path.posix.relative(path.posix.dirname(file), a.file), { id: a.id, lengths: a.lengths }]);
                        chunk.code += `\nfunction __STAM_OWNED_EXCEPTION_ARTIFACT__(url){return (__STAM_OWNED_EXCEPTION_ARTIFACT__.index ??= new Map(${JSON.stringify(rows)}.map(([p,a])=>[new URL(p,import.meta.url).href,a]))).get(url)}\n`;
                    }
                    const id = ids.get(file);
                    if (!id) continue;
                    writeFileSync(path.join(privateDir, `${id}.js`), chunk.code + `//# sourceMappingURL=${id}.js.map\n`, { mode: 0o600 });
                }
                for (const key of Object.keys(bundle)) if (key.endsWith('.map')) delete bundle[key];
            },
        },
        writeBundle() {
            // Also inspect copied public assets (outside Rollup's generated bundle).
            for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
                if (entry.isSymbolicLink() || entry.name.endsWith('.map') || (entry.isFile() && /\.(?:m?js|css)$/.test(entry.name)
                    && /(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/.test(readFileSync(path.join(entry.parentPath, entry.name), 'utf8')))) {
                    throw new Error('Public release output contains a source map, map reference or symbolic link');
                }
            }
            if (options.upload) {
                if (!process.env.SENTRY_URL || !options.release
                    || !process.env.SENTRY_ORG || !process.env.SENTRY_PROJECT || !process.env.SENTRY_AUTH_TOKEN) throw new Error('Missing private Errors upload settings');
                execFileSync('sentry-cli', ['sourcemaps', 'upload', '--release', options.release, '--validate', '--wait', privateDir], { stdio: 'ignore', timeout: 120_000 });
            }
        },
    };
}
