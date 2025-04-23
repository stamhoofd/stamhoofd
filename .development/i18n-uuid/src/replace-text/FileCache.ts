import fs from "fs";
import path from "node:path";

const cachePath = path.normalize(__dirname + '/../../..') + '/file-cache.txt';
const doubtCachePath = path.normalize(__dirname + '/../../..') + '/file-cache-doubt.txt';
const separator = ';';

class FileCache {
    private cache: Set<string>;
    private doubtCache: Set<string>;

    constructor() {
        this.cache = this.readCache(cachePath);
        this.doubtCache = this.readCache(doubtCachePath);
    }

    private readCache(path: string) {
        const content = fs.readFileSync(path, "utf8");
        return new Set(content.split(separator));
    }

    hasFile(file: string) {
        return this.cache.has(file) || this.doubtCache.has(file);
    }

    addFile(file: string) {
        this.cache.add(file);
        this.writeCache();
    }

    doubtFile(file: string) {
        this.doubtCache.add(file);
        this.writeDoubtCache();
    }

    clear() {
        fs.writeFileSync(cachePath, '');
        fs.writeFileSync(doubtCachePath, '');
    }

    private writeCache() {
        const newContent = [...this.cache].join(separator);
        fs.writeFileSync(cachePath, newContent);
    }

    private writeDoubtCache() {
        const newContent = [...this.doubtCache].join(separator);
        fs.writeFileSync(doubtCachePath, newContent);
    }
}

export const fileCache = new FileCache();
