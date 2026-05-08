import type { Decoder } from '@simonbackx/simple-encoding';
import { useGlobalEventListener, useRequiredOrganization } from '@stamhoofd/components';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { OrganizationPackagesStatus } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { onMounted, ref } from 'vue';

let sharedState: null | {
    organizationId: string
    loading: Ref<boolean>;
    packages: Ref<OrganizationPackagesStatus | null>;
    pendingLoad: Promise<OrganizationPackagesStatus | undefined> | null;
} = null;

export function useOrganizationPackages(options?: {
    errors?: { errorBox: ErrorBox | null };
    onMounted?: boolean;
}) {
    const organization = useRequiredOrganization()
    if (sharedState?.organizationId !== organization.value.id) {
        sharedState = null;
    }

    const context = useContext();
    const loading = sharedState?.loading ?? ref(false);
    const owner = useRequestOwner();
    const packages = sharedState?.packages ?? ref(null) as Ref<OrganizationPackagesStatus | null>;

    // Cache
    sharedState = {
        organizationId: organization.value.id,
        loading,
        packages,
        pendingLoad: sharedState?.pendingLoad ?? null,
    };

    async function loadIfMissing() {
        if (packages.value === null) {
            await reload();
        }
    }

    async function reloadIfSet() {
        if (packages.value !== null) {
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
        return promise.then((p) => {
            if (sharedState) {
                sharedState.pendingLoad = null;
            }
            return p
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
            return response.data;
        }
        catch (e) {
            if (options?.errors) {
                options.errors.errorBox = new ErrorBox(e);
            }
            else {
                throw e;
            }
        } finally {
            loading.value = false;
        }
    }

    if (options?.onMounted) {
        onMounted(() => {
            loadIfMissing().catch(console.error);
        });
    }

    useGlobalEventListener('payment-succeeded', async () => {
        await reloadIfSet()
    })

    return {
        loading,
        packages,
        reload,
        loadIfMissing,
    };
}
