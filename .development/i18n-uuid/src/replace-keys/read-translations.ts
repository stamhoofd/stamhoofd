import chalk from "chalk";
import fs from "fs";

export function readTranslations(filePath: string): Record<string, string> {
    const content = fs.readFileSync(filePath, "utf8");

    try {
        return JSON.parse(content);
    } catch (e) {
        console.error(chalk.red(e));
        console.error(chalk.red(`file path: ${filePath}`))
        console.error(chalk.red(`content: ${content}`));
        throw e;
    }
}
