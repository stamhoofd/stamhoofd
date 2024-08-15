/**
 * Search all occurrences of @field({*, ...NextVersion}) (multiple lines) in the code
 */
const {promises: fs} = require('fs');
const path = require('path');
const chalk = require('chalk');
const excludedFolder = ['node_modules', 'dist'];

const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);

// Note: we should not import the compiled structures directly here, since they would need to be compiled first
let currentVersion = 0;
let nextVersion = 0;
let replaceBy = 'version: ' + nextVersion;

const needle = '...NextVersion';
const dryRun = false;
let foundUsage = false;

async function processFile(filePath) {
    if (!filePath.endsWith('.ts')) {
        return;
    }
    const content = await fs.readFile(filePath, 'utf8');

    const state = {
        atStack: '', // contains @, @f, @fi, @fie, @field
        parenthesisDepth: 0, // 0 when atStack if not @field, then 1 once first ( is found, 2 if second ( is found, etc.
        curlyBracketsDepth: 0, // 0 when atStack if not @field, then 1 once first { is found, 2 if second { is found, etc.
        contentStack: '', // contents inside @field({ (so atStack is @field, parenthesisDepth is 1 and curlyBracketsDepth is 1)
        commentLineStack: ''
    }

    let newContent = null;
    
    // Loop all characters in a simple state machine
    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        if (state.commentLineStack === '//') {
            // Ignore until next line
            if (char === '\n') {
                state.commentLineStack = '';
            }
            continue;
        }

        if (char === '/') {
            state.commentLineStack += '/'
        } else {
            state.commentLineStack = '';
        }

        if (state.atStack === '@field') {
            switch (char) {
                case '(':
                    state.parenthesisDepth++;
                    state.contentStack = '';
                    break;
                case ')':
                    state.parenthesisDepth--;
                    state.contentStack = '';

                    if (state.parenthesisDepth === 0) {
                        // Reset
                        state.atStack = '';
                        state.curlyBracketsDepth = 0;
                    }
                    break;
                case '{':
                    state.curlyBracketsDepth++;
                    state.contentStack = '';
                    break;
                case '}':
                    state.curlyBracketsDepth--;
                    state.contentStack = '';
                    break;
                default:
                    {
                        if (state.parenthesisDepth === 1 && state.curlyBracketsDepth === 1) {
                            state.contentStack += char;

                            if (state.contentStack.endsWith(needle)) {
                                // Found!

                                const startIndex = i - needle.length + 1;
                                const endIndex = i;

                                // Replace
                                if (!newContent) {
                                    console.log('Found new field in ' + filePath);
                                    newContent = content;
                                }
                                newContent = newContent.substring(0, startIndex) + replaceBy + newContent.substring(endIndex + 1);

                                state.contentStack = ''
                            }
                        } else {
                            state.contentStack = '';
                        }
                    }
            }
        } else if (state.atStack === '@fie') {
            if (char === 'l') {
                state.atStack = '@field';
            } else {
                state.atStack = '';
                state.contentStack = '';
            }
        } else if (state.atStack === '@fi') {
            if (char === 'e') {
                state.atStack = '@fie';
            } else {
                state.atStack = '';
                state.contentStack = '';
            }
        } else if (state.atStack === '@f') {
            if (char === 'i') {
                state.atStack = '@fi';
            } else {
                state.atStack = '';
                state.contentStack = '';
            }
        } else if (state.atStack === '@') {
            if (char === 'f') {
                state.atStack = '@f';
            } else {
                state.atStack = '';
                state.contentStack = '';
            }
        } else {
            if (char === '@') {
                state.atStack = '@';
            }
        }
    }

    if (!dryRun) {
        if (newContent) {
            foundUsage = true;
            await fs.writeFile(filePath, newContent);
        }
    }
}

async function readVersion() {
    const versionPath = path.join(__dirname, '..', 'shared/structures/src/Version.ts');
    const content = await fs.readFile(versionPath, 'utf8');
    const match = content.match(/Version = (\d+)/);
    if (match) {
        const v = parseInt(match[1]);
        if (v === 0 || isNaN(v)) {
            throw new Error('Failed to read current version');
        }

        currentVersion = v;
        nextVersion = v + 1;
        replaceBy = 'version: ' + nextVersion;

    } else {
        throw new Error('Failed to read current version');
    }
}

async function loopFolder(folderPath) {
    // Loop all directories and files
    const files = await fs.readdir(folderPath);
    
    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory() && !excludedFolder.includes(file)) {
            await loopFolder(filePath);
        } else {
            await processFile(filePath);
        }
    }

}

async function run() {
    await readVersion();

    console.log(chalk.bold(chalk.blueBright('Increasing structures version to ' + nextVersion + '... (if changed)\n')));

    if (!dryRun) {
        // Update remotes
        await exec('git remote update');

        // First check if we are on the main branch and no changes are pending
        const {stdout} = await exec('git status --porcelain');
        if (stdout.trim()) {
            console.error(chalk.red('You have pending changes in Git. Please commit to main before releasing a new version.'));

            // Exit non-zero
            process.exit(1);
            return;
        }

        // Check branch + up to date
        const {stdout: branch} = await exec('git branch --show-current');
        if (branch.trim() !== 'main') {
            console.error(chalk.red('You are not on the main branch. Please checkout main before releasing a new version.'));

            // Exit non-zero
            process.exit(1);
            return;
        }


        const {stdout: status} = await exec('git status -uno');
        if (!status.includes("Your branch is up to date with 'origin/main'")) {
            console.error(chalk.red('Your branch is not up to date with origin/main. Please pull before releasing a new version.'));

            // Exit non-zero
            process.exit(1);
            return;
        }
    }

    await loopFolder(path.join(__dirname, '..'));

    if (!foundUsage) {
        console.log(chalk.green('No new fields found. Structures version not bumped.'));
    } else {
        // Write new version to shared/structures/src/Version.ts
        const versionPath = path.join(__dirname, '..', 'shared/structures/src/Version.ts');
        const currentContent = await fs.readFile(versionPath, 'utf8');
        const newContent = currentContent.replace('Version = ' + currentVersion, 'Version = ' + nextVersion);

        if (newContent === currentContent) {
            console.error(chalk.red('Failed to update version in Version.ts. Please revert changes using Git.'));
            process.exit(1);
        }
        
        if (!dryRun) {
            await fs.writeFile(versionPath, newContent);
        }

        console.log(chalk.bold('Found and wrote new fields. Structures version bumped from ' + currentVersion + ' to ' + chalk.yellow(nextVersion)));

        // Release to GitHub
        console.log(chalk.bold('Commiting and pushing changes...'));
        await exec('git add . && git commit -m "Increased structures to version ' + nextVersion + '" && git push');

        console.log(chalk.green('✔ Increased structures to version ' + nextVersion + ' successfully!'));
    }
}

run().catch(console.error);
