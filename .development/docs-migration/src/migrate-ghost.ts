import { readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

// --- Paths & config ---------------------------------------------------------

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(packageDir, '..', '..');
const contentDir = join(repoDir, 'docs', 'content');

/**
 * Uploads are downloaded into these subfolders of docs/public and served
 * statically from `/images/...`, `/media/...` and `/files/...`.
 */
const publicDir = join(repoDir, 'docs', 'public');
const ASSET_DIRS = ['images', 'media', 'files'] as const;

interface Options {
    input: string | null;
    clean: boolean;
    yes: boolean;
}

function parseArgs(argv: string[]): Options {
    let input: string | null = null;
    let clean = false;
    let yes = false;
    for (const arg of argv) {
        if (arg === '--clean') clean = true;
        else if (arg === '--yes' || arg === '-y') yes = true;
        else if (!arg.startsWith('-') && !input) input = resolve(arg);
    }
    if (!input && !clean) {
        console.error('Nothing to do: pass an export path to import, and/or --clean.');
        process.exit(1);
    }
    return { input, clean, yes };
}

/**
 * Remove everything under content/ and the downloaded uploads. The landing page
 * is a Vue page, not content, and other files in public/ (the logo) are kept.
 */
function cleanContentDir(): void {
    for (const entry of readdirSync(contentDir)) {
        rmSync(join(contentDir, entry), { recursive: true, force: true });
    }
    for (const dir of ASSET_DIRS) {
        rmSync(join(publicDir, dir), { recursive: true, force: true });
    }
}

/** Ask before the destructive clean. Requires a TTY unless --yes is passed. */
async function confirmClean(auto: boolean): Promise<boolean> {
    if (auto) return true;
    if (!process.stdin.isTTY) {
        console.error('✖ Refusing to clean without confirmation in a non-interactive shell. Pass --yes to proceed.');
        return false;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer: string = await rl.question(`This deletes everything under ${contentDir} and the downloaded uploads in ${publicDir}. Continue? [y/N] `);
    rl.close();
    return /^y(?:es)?$/i.test(answer.trim());
}

// --- Import (migration logic removed) ---------------------------------------

/**
 * Turn a Ghost export into Docus content.
 */
async function importExport(input: string): Promise<void> {
    void input;
    throw new Error('Not yet implemented');
}

// --- Main -------------------------------------------------------------------

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2));

    // --clean is destructive, so confirm before wiping (both clean-only and
    // clean-then-import go through here).
    if (opts.clean) {
        if (!(await confirmClean(opts.yes))) {
            console.log('Aborted.');
            return;
        }
        cleanContentDir();
        console.log();
        console.log(`✔ Cleaned ${contentDir}.`);
        if (!opts.input) return; // clean-only: nothing to import
    }

    if (!opts.input) return; // parseArgs guarantees input here, but keep TS happy

    if (!existsSync(opts.input)) {
        console.error(`✖ Ghost export not found at: ${opts.input}`);
        process.exit(1);
    }

    await importExport(opts.input);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
