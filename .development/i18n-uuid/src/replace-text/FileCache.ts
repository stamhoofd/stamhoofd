import fs from "fs";
import path from "node:path";

const cachePath = path.normalize(__dirname + '/../../..') + '/file-cache.txt';
const separator = ';';

class FileCache {
    private cache: Set<string>;

    constructor() {
        this.cache = this.readFileCache();
    }

    private readFileCache() {
        const content = fs.readFileSync(cachePath, "utf8");
        return new Set(content.split(separator));
    }

    hasFile(file: string) {
        return this.cache.has(file);
    }

    addFile(file: string) {
        this.cache.add(file);
        this.writeCache();
    }

    clear() {
        fs.writeFileSync(cachePath, '');
    }

    private writeCache() {
        const newContent = [...this.cache].join(separator);
        fs.writeFileSync(cachePath, newContent);
    }
}

export const fileCache = new FileCache();
