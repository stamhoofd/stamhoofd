import fs from 'fs';
import path from 'path';
import { globals } from './globals.js';

export type FileTypeToSearch = 'vue' | 'typescript' | 'handlebars' | 'eslint';

/**
 * File types that can contain `$t(...)` or `{{$t "..."}}` usages.
 */
export const translatableFileTypes: FileTypeToSearch[] = ['typescript', 'vue', 'handlebars'];

export function getFilesToSearch(types: FileTypeToSearch[]): string[] {
    const root = globals.I18NUUID_ROOT;

    const includes: RegExp[] = [];

    if (types.includes('vue')) {
        includes.push(/\.vue$/);
    }

    if (types.includes('typescript')) {
        includes.push(/\.ts$/);
    }

    if (types.includes('handlebars')) {
        includes.push(/\.hbs(\.html)?$/);
    }

    if (types.includes('eslint')) {
        includes.push(/eslint\.config\.mjs$/);
    }

    const excludeDirectories = globals.I18NUUID_EXCLUDE_DIRS_ARRAY;

    const getAllEligibleFiles = (dir: string) => {
        const files = fs.readdirSync(dir);
        const filePaths: string[] = [];

        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                if (includes.some(regex => regex.test(filePath))) {
                    filePaths.push(filePath);
                }

                continue;
            }

            if (stats.isDirectory()) {
                if (file.startsWith('.')) continue;
                if (excludeDirectories.some(dir => dir === file)) {
                    continue;
                }
                const nestedFiles = getAllEligibleFiles(filePath);
                for (const nestedFile of nestedFiles) {
                    filePaths.push(nestedFile);
                }
            }
        }

        return filePaths;
    };

    return getAllEligibleFiles(root);
}
