import chalk from 'chalk';
import fs from 'fs';

export function readTranslations(filePath: string): Map<string, unknown> {
    const content = fs.readFileSync(filePath, 'utf8');

    try {
        return new Map(Object.entries(JSON.parse(content)));
    }
    catch (e) {
        console.error(chalk.red(e));
        console.error(chalk.red(`file path: ${filePath}`));
        console.error(chalk.red(`content: ${content}`));
        throw e;
    }
}
