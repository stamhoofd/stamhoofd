import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { Toast } from '#overlays/Toast.ts';
import type { Decoder } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { User } from '@stamhoofd/structures';
import { OrganizationAdmins } from '@stamhoofd/structures';
import { reactive, computed } from 'vue';

const reloadPromises = reactive(new Map<null | string, Promise<unknown>>());
const cachedAdmins = reactive(new Map<string | null, User[]>());

export function useLoadOrganizationAdmins() {
    const context = useContext();
    const owner = useRequestOwner();
    
    return async function loadAdmins(shouldRetry = true) {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/organization/admins',
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>,
            shouldRetry,
            owner,
        });
        cachedAdmins.set(context.value.organization?.id ?? null, response.data.users);
        return response.data;
    }
}

export function useLoadPlatformAdmins() {
    const context = useContext();
    const owner = useRequestOwner();
    
    return async function loadAdmins(shouldRetry = true) {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/platform/admins',
            decoder: OrganizationAdmins as Decoder<OrganizationAdmins>,
            shouldRetry,
            owner,
        });
        cachedAdmins.set(null, response.data.users);
        return response.data;
    }
}


export function useLoadAdmins() {
    const organization = useOrganization();
    const pop = usePop();
    const loadAdmins = useLoadOrganizationAdmins();
    const loadPlatformAdmins = useLoadPlatformAdmins();

    const hasAdmins = computed(() => {
        return !!cachedAdmins.has(organization.value ? organization.value.id : null)
    });

    const admins = computed(() => {
        return cachedAdmins.get(organization.value ? organization.value.id : null) ?? [];
    });

    function getReloadPromise() {
        const id = organization.value?.id ?? null;
        return reloadPromises.get(id) ?? null;
    }

    const loading = computed(() => {
        const reloadPromise = getReloadPromise();
        return !!reloadPromise;
    });

    function setReloadPromise(p: Promise<unknown>) {
        const id = organization.value?.id ?? null;
        reloadPromises.set(id, p);
        p.catch(console.error).finally(() => {
            console.log('Finished loading admins, removing reload promise', reloadPromises);
            reloadPromises.delete(id);
        })
        return p;
    }

    function load(shouldRetry = true) {
        console.log('Reloading admins with shouldRetry = ', shouldRetry);
        const p = getReloadPromise();
        if (p) {
            return p;
        }
        if (organization.value) {
            return setReloadPromise(
                loadAdmins(shouldRetry).catch((e) => {
                    Toast.fromError(e).show();
                    pop({ force: true })?.catch(console.error);
                }),
            );
        }
        else {
            return setReloadPromise(
                loadPlatformAdmins(shouldRetry).catch((e) => {
                    Toast.fromError(e).show();
                    pop({ force: true })?.catch(console.error);
                }),
            );
        }
    }

    return {admins, hasAdmins, loading, load, loadPromise: () => getReloadPromise()};
}
