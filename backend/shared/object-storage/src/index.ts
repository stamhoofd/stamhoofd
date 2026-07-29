function normalizeRoot(root: string): string {
    const normalized = root.replace(/^\/+|\/+$/g, '');
    return normalized.length === 0 ? '' : `${normalized}/`;
}

export function buildStoragePrefix(options: { spacesPrefix?: string; environment: string }): string {
    let root = normalizeRoot(options.spacesPrefix ?? '');

    if (options.environment !== 'production') {
        const environmentRoot = `${options.environment}/`;
        if (root !== environmentRoot && !root.endsWith(`/${environmentRoot}`)) {
            root += environmentRoot;
        }
    }

    return root;
}

export function buildDayPrefix(root: string, date: Date): string {
    const day = date.toISOString().slice(0, 10).replaceAll('-', '/');
    return `${normalizeRoot(root)}d/${day}/`;
}

export function buildObjectKey(options: {
    root: string;
    date: Date;
    isPrivate: boolean;
    userId?: string;
    fileId: string;
    filename: string;
}): string {
    const accessPrefix = options.isPrivate
        ? `users/${requireUserId(options.userId)}/`
        : 'p/';

    return `${buildDayPrefix(options.root, options.date)}${accessPrefix}${options.fileId}/${options.filename}`;
}

export function parseDayFromKey(key: string, root: string): string | null {
    const relativeKey = stripRoot(key, root);
    const match = /^d\/(\d{4})\/(\d{2})\/(\d{2})\//.exec(relativeKey);
    if (!match) {
        return null;
    }

    const day = `${match[1]}-${match[2]}-${match[3]}`;
    const parsed = new Date(`${day}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day ? null : day;
}

export function isLegacyKey(key: string, root: string): boolean {
    const relativeKey = stripRoot(key, root);
    return relativeKey.length > 0 && !relativeKey.startsWith('d/') && !relativeKey.startsWith('_sync/');
}

function stripRoot(key: string, root: string): string {
    const normalizedRoot = normalizeRoot(root);
    if (!key.startsWith(normalizedRoot)) {
        return '';
    }
    return key.slice(normalizedRoot.length);
}

function requireUserId(userId: string | undefined): string {
    if (!userId) {
        throw new Error('A userId is required for private object storage keys');
    }
    return userId;
}
