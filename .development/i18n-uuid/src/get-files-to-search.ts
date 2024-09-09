import fs from "fs";
import path from "path";
import { globals } from "./globals";

export function getFilesToSearch(): string[] {
    const root = globals.I18NUUID_ROOT;
    const typescript = /^[^.]+.ts$/;
    const vue = /^[^.]+.vue$/;

    const includes = [
        typescript,
        vue
    ]

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
                if(file.startsWith('.')) continue;
                if(excludeDirectories.some(dir => dir === file)) {
                    continue;
                }
                const nestedFiles = getAllEligibleFiles(filePath);
                for(const nestedFile of nestedFiles) {
                    filePaths.push(nestedFile);
                }
            }
        }

        return filePaths;
    };

    return getAllEligibleFiles(root);
}
