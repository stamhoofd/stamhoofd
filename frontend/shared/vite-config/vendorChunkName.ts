/**
 * Returns the chunk of the vendor for a given node_modules path dependency.
 *
 * One chunk per npm package > ~3 KB. Cache invalidation
 * becomes per-library instead of per-app-revision.
 */
export function getVendorChunkName(id: string): string | undefined {
    const nodeModulesIndex = id.lastIndexOf('/node_modules/');
    if (nodeModulesIndex === -1) {
        return;
    }

    const [nameOrScope, scopedName] = id.slice(nodeModulesIndex + '/node_modules/'.length).split('/');
    const packageName = nameOrScope.startsWith('@')
        ? scopedName ? `${nameOrScope}/${scopedName}` : undefined
        : nameOrScope;

    return packageName ? `vendor-${packageName}` : undefined;
}
