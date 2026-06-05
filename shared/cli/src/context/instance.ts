import { slug } from './workspace.js';

function checksum(value: string): number {
    let hash = 0;
    for (const char of value) {
        hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    }
    return Math.abs(hash);
}

export function buildInstance(options: { env: string; workspace: string; primary: boolean; overrideName?: string }) {
    const envSlug = slug(options.env) || 'stamhoofd';
    const inferredPrefix = options.primary ? '' : slug(options.workspace);
    const prefix = slug(process.env.STAMHOOFD_INSTANCE_PREFIX ?? inferredPrefix);
    const primary = options.primary && !prefix;
    const baseName = primary ? 'stamhoofd' : `stamhoofd-${prefix || options.workspace}`;
    const inferredName = envSlug === 'stamhoofd' ? baseName : `${baseName}-${envSlug}`;
    const name = slug(options.overrideName ?? process.env.STAMHOOFD_DEV_NAME ?? inferredName) || 'stamhoofd';
    const defaultOffset = primary && envSlug === 'stamhoofd' ? 0 : ((checksum(`${options.workspace}:${envSlug}`) % 50) + 1) * 100;
    const configuredOffset = Number.parseInt(process.env.STAMHOOFD_PORT_OFFSET ?? `${defaultOffset}`, 10);

    return {
        name,
        prefix: primary ? '' : prefix,
        primary,
        portOffset: Number.isFinite(configuredOffset) ? configuredOffset : defaultOffset,
    };
}
