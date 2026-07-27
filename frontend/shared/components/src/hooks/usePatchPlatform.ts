import type { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { savePlatformToStorage } from '@stamhoofd/networking/loadPlatform';
import { Platform } from '@stamhoofd/structures';
import { useContext } from './useContext';

/**
 * Patch the platform, and keep the platform of the context (and its local storage cache) in sync
 * with the response.
 */
export function usePatchPlatform() {
    const context = useContext();
    const owner = useRequestOwner();

    return async function patch(patch: AutoEncoderPatchType<Platform>, options: { shouldRetry?: boolean } = {}) {
        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/platform',
            body: patch,
            decoder: Platform as Decoder<Platform>,
            shouldRetry: options.shouldRetry ?? false,
            owner,
        });

        context.value.updatePlatform(response.data);

        // Save platform in localstorage
        savePlatformToStorage(context.value.platform).catch(console.error);
    };
}
