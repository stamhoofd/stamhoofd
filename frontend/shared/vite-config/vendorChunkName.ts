/**
 * One chunk per npm package > ~3 KB. Cache invalidation
 * becomes per-library instead of per-app-revision.
 */
export function getVendorChunkName(id: string): string | undefined {
    if (id.includes('node_modules')) {
        const packageName = id.match(/node_modules\/([^/]+)/)?.[1];
        if (packageName) {
            return `vendor-${packageName}`;
        }
    }
}
