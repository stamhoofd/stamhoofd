import type { Decoder } from '@simonbackx/simple-encoding';
import { ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { AuditLogReplacementDependencies, Platform, Version } from '@stamhoofd/structures';
import { uuidToName } from '@stamhoofd/structures/helpers/uuidToName.js';
import { NetworkManager } from './NetworkManager';
import { Storage } from './Storage';

/**
 * Write the platform to local storage, so the next boot can start from it (see loadPlatform)
 * instead of waiting for the network.
 */
export async function savePlatformToStorage(platform: Platform): Promise<void> {
    await Storage.keyValue.setItem('platform', JSON.stringify(new VersionBox(platform).encode({ version: Version })));
}

/**
 * Read the cached platform from local storage.
 * Returns null when there is nothing cached, or when the cached value cannot be decoded.
 */
export async function loadPlatformFromStorage(): Promise<Platform | null> {
    try {
        const value = await Storage.keyValue.getItem('platform');

        if (!value) {
            return null;
        }
        const decoder = new VersionBoxDecoder(Platform as Decoder<Platform>);
        const result = decoder.decode(new ObjectData(JSON.parse(value), { version: 0 }));

        return result.data;
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Fetch the public platform over an unauthenticated server.
 *
 * A SessionContext requires a platform, so this cannot use one: at this point in the boot flow no
 * session exists yet. That is fine, because the platform without its privateConfig is public.
 * Sessions that need the privateConfig upgrade it later with SessionContext.fetchPlatform().
 */
async function fetchPublicPlatform(): Promise<Platform> {
    const response = await NetworkManager.server.request({
        method: 'GET',
        path: '/platform',
        decoder: Platform as Decoder<Platform>,
    });
    return response.data;
}

/**
 * Resolve the platform an app boots with, before any session exists.
 *
 * This is deliberately its own module because it is the seam that will become the tenant lookup:
 * with multi-tenancy the platform is determined by the domain the app is served on, so this
 * function (and only this function) will be replaced by a domain -> tenant resolution. Everything
 * else already takes the platform as an argument.
 *
 * The returned platform is the app level platform: it is handed to the SessionContext, which never
 * replaces the reference (updatePlatform uses deepSet). Because of that stability, this is also
 * where the two things that cannot be passed a platform get bound, exactly once per app level
 * platform:
 * - Platform.shared, still read by UserPermissions.
 * - The audit log uuid resolver, which renders a uuid from a bare id deep inside
 *   AuditLogReplacement and cannot receive a platform through its call chain.
 *
 * Throwaway sessions (e.g. the account switcher) reuse the app level platform instead of calling
 * this, so they never stamp anything.
 */
export async function loadPlatform(): Promise<{ platform: Platform; fromCache: boolean }> {
    const cached = await loadPlatformFromStorage();
    const platform = cached ?? (await fetchPublicPlatform());

    platform.setShared();
    AuditLogReplacementDependencies.uuidToName = uuid => uuidToName(uuid, platform);

    // The caller needs to know whether this is a possibly stale cached platform, so it can decide
    // whether a refresh is still needed: a platform we just fetched does not need one.
    return { platform, fromCache: cached !== null };
}
