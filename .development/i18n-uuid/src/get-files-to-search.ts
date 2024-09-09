import fs from "fs";
import path from "path";

export function getFilesToSearch(): string[] {
    const root = "/Users/bjarne/Projects/stamhoofd";
    const typescript = /^[^.]+.ts$/;
    const vue = /^[^.]+.vue$/;

    const includes = [
        typescript,
        vue
    ]

    const excludeDirectories = [
        'dist',
        'esm',
        'node_modules',
    ]

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
