import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import { run, RunVerbosity } from './command-runner.js';
import { readReleasedVersion, replaceNextVersion, writeReleasedVersion } from './next-version-scanner.js';
import { info, success, warning } from './ux.js';

const excludedFolders = ['node_modules', 'dist', 'dist-types', '.development'];
const versionFile = 'shared/structures/src/Version.ts';

export type IncreaseStructuresVersionOptions = {
    /** Repository root */
    cwd: string;
    /** Skip the git checks (clean working tree, on main, up to date with origin/main) */
    force?: boolean;
    /** Report what would change without writing, committing or pushing */
    dryRun?: boolean;
};

/**
 * Replaces every `...NextVersion` in the repository by `ReleasedVersion + 1`, bumps `ReleasedVersion` in
 * `Version.ts` and commits and pushes the result. Does nothing when no `...NextVersion` is used.
 */
export async function increaseStructuresVersion(options: IncreaseStructuresVersionOptions): Promise<void> {
    const { cwd, force = false, dryRun = false } = options;
    const versionPath = path.join(cwd, versionFile);

    const currentVersion = readReleasedVersion(await fs.readFile(versionPath, 'utf8'));
    const nextVersion = currentVersion + 1;
    const replaceBy = 'version: ' + nextVersion;

    info(chalk.bold(chalk.blueBright('Increasing structures version to ' + nextVersion + '... (if changed)\n')));

    if (!dryRun && !force) {
        await assertReleasableCheckout(cwd);
    }

    const changedFiles: string[] = [];
    await loopFolder(cwd, async (filePath) => {
        if (!filePath.endsWith('.ts')) {
            return;
        }
        // Test files use ...NextVersion in fixtures and must keep doing so after a release
        if (filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) {
            return;
        }
        const content = await fs.readFile(filePath, 'utf8');
        const { content: newContent, replaced } = replaceNextVersion(content, replaceBy);
        if (replaced === 0) {
            return;
        }

        info('Found new field in ' + filePath);
        changedFiles.push(filePath);
        if (!dryRun) {
            await fs.writeFile(filePath, newContent);
        }
        else {
            warning(chalk.yellow('Dry run: ' + filePath + ' not updated.'));
        }
    });

    if (changedFiles.length === 0) {
        info(chalk.green('No new fields found. Structures version not bumped.'));
        return;
    }

    const currentContent = await fs.readFile(versionPath, 'utf8');
    let newContent: string;
    try {
        newContent = writeReleasedVersion(currentContent, currentVersion, nextVersion);
    }
    catch {
        throw new Error('Failed to update version in Version.ts. Please revert changes using Git.');
    }

    if (!dryRun) {
        await fs.writeFile(versionPath, newContent);
    }
    else {
        warning(chalk.yellow('Dry run: Version.ts not updated.'));
    }

    info(chalk.bold('Found and wrote new fields. Structures version bumped from ' + currentVersion + ' to ' + chalk.yellow(nextVersion)));
    info(chalk.bold('Commiting and pushing changes...'));

    if (!dryRun) {
        await run('git', ['add', '.'], { cwd, verbosity: RunVerbosity.Quiet });
        await run('git', ['commit', '-m', 'Increased structures to version ' + nextVersion], { cwd, verbosity: RunVerbosity.Quiet });
        await run('git', ['push'], { cwd, verbosity: RunVerbosity.Quiet });
    }
    else {
        warning(chalk.yellow('Dry run: Changes not commited or pushed.'));
    }

    success('Increased structures to version ' + nextVersion + ' successfully!');
}

async function assertReleasableCheckout(cwd: string): Promise<void> {
    await run('git', ['remote', 'update'], { cwd, verbosity: RunVerbosity.Quiet });

    const { stdout: status } = await run('git', ['status', '--porcelain'], { cwd, capture: true, verbosity: RunVerbosity.Quiet });
    if (status.trim()) {
        throw new Error('You have pending changes in Git. Please commit to main before releasing a new version.');
    }

    const { stdout: branch } = await run('git', ['branch', '--show-current'], { cwd, capture: true, verbosity: RunVerbosity.Quiet });
    if (branch.trim() !== 'main') {
        throw new Error('You are not on the main branch. Please checkout main before releasing a new version.');
    }

    const { stdout: tracking } = await run('git', ['status', '-uno'], { cwd, capture: true, verbosity: RunVerbosity.Quiet });
    if (!tracking.includes("Your branch is up to date with 'origin/main'")) {
        throw new Error('Your branch is not up to date with origin/main. Please pull before releasing a new version.');
    }
}

async function loopFolder(folderPath: string, processFile: (filePath: string) => Promise<void>): Promise<void> {
    const files = await fs.readdir(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            if (excludedFolders.includes(file) || await isNestedCheckout(filePath)) {
                continue;
            }
            await loopFolder(filePath, processFile);
        }
        else {
            await processFile(filePath);
        }
    }
}

/**
 * Nested git checkouts (worktrees, submodules) contain a .git entry and have their own pending fields
 */
async function isNestedCheckout(folderPath: string): Promise<boolean> {
    try {
        await fs.access(path.join(folderPath, '.git'));
        return true;
    }
    catch {
        return false;
    }
}
