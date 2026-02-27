import { Decoder } from '@simonbackx/simple-encoding';
import { ErrorBox, useContext } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { OrganizationPackagesStatus } from '@stamhoofd/structures';
import { onMounted, Ref, ref } from 'vue';

let sharedState: null | {
    loading: Ref<boolean>;
    packages: Ref<OrganizationPackagesStatus | null>;
    pendingLoad: Promise<void> | null;
} = null;

export function useOrganizationPackages(options?: {
    errors?: { errorBox: ErrorBox | null };
    onMounted?: boolean;
}) {
    const context = useContext();
    const loading = sharedState?.loading ?? ref(false);
    const owner = useRequestOwner();
    const packages = sharedState?.packages ?? ref(null) as Ref<OrganizationPackagesStatus | null>;

    // Cache
    sharedState = {
        loading,
        packages,
        pendingLoad: sharedState?.pendingLoad ?? null,
    };

    async function loadIfMissing() {
        if (packages.value === null) {
            await reload();
        }
    }

    // Some magic to make sure that two calls to reload will await the same promise and network requests
    // that makes the hook safe to reuse in multiple subhooks at the same time
    async function reload() {
        if (sharedState?.pendingLoad) {
            return sharedState?.pendingLoad;
        }
        const promise = _reload();
        if (sharedState) {
            sharedState.pendingLoad = promise;
        }
        return promise.then(() => {
            if (sharedState) {
                sharedState.pendingLoad = null;
            }
        });
    }

    async function _reload() {
        if (loading.value) {
            // Should not really happen
            return;
        }

        loading.value = true;

        try {
            const response = await context.value.authenticatedServer.request({
                method: 'GET',
                path: '/organization/packages',
                owner,
                decoder: OrganizationPackagesStatus as Decoder<OrganizationPackagesStatus>,
            });

            packages.value = response.data;
        }
        catch (e) {
            if (options?.errors) {
                options.errors.errorBox = new ErrorBox(e);
            }
            else {
                throw e;
            }
        }

        loading.value = false;
    }

    if (options?.onMounted) {
        onMounted(() => {
            loadIfMissing().catch(console.error);
        });
    }

    return {
        loading,
        packages,
        reload,
        loadIfMissing,
    };
}
