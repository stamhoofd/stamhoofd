/** Package name targeted by an import specifier, or null for relative, absolute and '#' subpath imports. */
export function getImportedPackageName(specifier) {
    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) {
        return null;
    }

    const parts = specifier.split('/');
    if (specifier.startsWith('@')) {
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    }
    return parts[0];
}

/**
 * Whether a library in /packages may depend on this package: anything outside the @stamhoofd scope,
 * or another library in /packages (published as @stamhoofd/common-*, node-* or browser-*).
 */
export function isAllowedStandaloneDependency(packageName) {
    return !packageName.startsWith('@stamhoofd/') || /^@stamhoofd\/(common|node|browser)-/.test(packageName);
}
