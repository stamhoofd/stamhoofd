import fs from "fs";
import path from "path";

export function getChildDirectories(parentDirectory: string): string[] {
    const files = fs.readdirSync(parentDirectory);
    const results: string[] = [];

    for (const file of files) {
        const filePath = path.join(parentDirectory, file);

        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            results.push(file);
        }
    }

    return results;
}

export function getChildFiles(parentDirectory: string): string[] {
    const files = fs.readdirSync(parentDirectory);
    const results: string[] = [];

    for (const file of files) {
        const filePath = path.join(parentDirectory, file);

        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            results.push(file);
        }
    }

    return results;
}
