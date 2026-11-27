import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import { oxcPackages, repositoryRoot, sourceExtensions } from '../src/ownership.js';

const [filePath] = process.argv.slice(2);
const extension = path.extname(filePath).slice(1);
const isEslintSource = sourceExtensions.includes(extension)
    && !oxcPackages.some(directory => filePath.startsWith(`${directory}/`));

if (isEslintSource) {
    const { createFormattingESLint } = await import('../src/format.js');
    const eslint = createFormattingESLint({ cwd: repositoryRoot, fix: true });
    const input = await buffer(process.stdin);
    const results = await eslint.lintText(input.toString('utf8'), {
        filePath: path.resolve(repositoryRoot, filePath),
        warnIgnored: false,
    });
    const diagnostics = (await eslint.loadFormatter('stylish')).format(results);
    if (diagnostics) console.error(diagnostics);
    if (results.some(result => result.errorCount)) process.exitCode = 1;
    else process.stdout.write(results[0]?.output ?? input);
} else {
    const result = spawnSync(path.join(repositoryRoot, 'node_modules/.bin/oxfmt'), [
        '--threads=1',
        `--stdin-filepath=${filePath}`,
    ], { cwd: repositoryRoot, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
}
