import fs from 'fs';
import path from 'node:path';

const cachePath = path.normalize(import.meta.dirname + '/../../..') + '/file-cache.txt';
const doubtCachePath = path.normalize(import.meta.dirname + '/../../..') + '/file-cache-doubt.txt';
const separator = ';';

class FileCache {
    private cache: Set<string>;
    private doubtCache: Set<string>;

    constructor() {
    }

    private loadIfNeeded() {
        if (this.cache || this.doubtCache) {
            return;
        }
        this.cache = this.readCache(cachePath);
        this.doubtCache = this.readCache(doubtCachePath);
    }

    private readCache(path: string) {
        const content = fs.readFileSync(path, 'utf8');
        return new Set(content.split(separator));
    }

    hasFile(file: string) {
        this.loadIfNeeded()
        return this.cache.has(file) || this.doubtCache.has(file);
    }

    addFile(file: string) {
        this.loadIfNeeded()
        this.cache.add(file);
        this.writeCache();
    }

    doubtFile(file: string) {
        this.loadIfNeeded()
        this.doubtCache.add(file);
        this.writeDoubtCache();
    }

    clear() {
        fs.writeFileSync(cachePath, '');
        fs.writeFileSync(doubtCachePath, '');
    }

    private writeCache() {
        this.loadIfNeeded()
        const newContent = [...this.cache].join(separator);
        fs.writeFileSync(cachePath, newContent);
    }

    private writeDoubtCache() {
        this.loadIfNeeded()
        const newContent = [...this.doubtCache].join(separator);
        fs.writeFileSync(doubtCachePath, newContent);
    }
}

export const fileCache = new FileCache();
