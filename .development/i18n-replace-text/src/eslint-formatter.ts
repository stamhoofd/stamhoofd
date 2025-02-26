import chalk from 'chalk';
import { exec } from 'child_process';
import { getFilesToSearch } from "./get-files-to-search";

class EslintFormatter {
    private readonly directoriesWithConfiguration: string[];

    constructor() {
        this.directoriesWithConfiguration = this.getDirectoriesWithEslintConfiguration();
    }

    async tryFixFile(filePath: string) {
        const configurationDirectory = this.getConfigurationDirectory(filePath);

        if(configurationDirectory) {
            console.log(chalk.gray(`Start eslint fix: ${filePath}`))
            await this.fixFile(filePath, configurationDirectory);
            console.log(chalk.gray(`Finished eslint fix: ${filePath}`))
        }
    }

    private async fixFile(filePath: string, configurationDirectory: string) {
        const relativePath = filePath.substring(configurationDirectory.length + 1);
        const command = `cd ${configurationDirectory} && npx eslint --fix ${relativePath}`;

        await new Promise(resolve => {
            exec(command, resolve);
        });
    }

    private getConfigurationDirectory(filePath: string): string | undefined {
        return this.directoriesWithConfiguration.find(directory => filePath.startsWith(directory));
    }


    private getDirectoriesWithEslintConfiguration() {
        const configurationFiles = getFilesToSearch(['eslint'])
        // get parent directory
        .map(file => file.replace(/\/eslint.config.mjs$/, ''));
    
        // longest path first
        configurationFiles.sort((a, b) => b.length - a.length);
        return configurationFiles;
    }
}

export const eslintFormatter = new EslintFormatter();
