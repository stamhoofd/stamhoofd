import { usePop } from '@simonbackx/vue-app-navigation';
import { Toast, useContext, useOrganization } from '@stamhoofd/components';
import { OrganizationManager, usePlatformManager } from '@stamhoofd/networking';
import { getCurrentInstance } from 'vue';

const reloadPromises = new Map<null | string, Promise<unknown>>();

export function useReloadAdmins() {
    const organization = useOrganization();
    const platformManager = usePlatformManager();
    const $context = useContext();
    const instance = getCurrentInstance();
    const pop = usePop();

    function getReloadPromise() {
        const id = organization.value?.id ?? null;
        return reloadPromises.get(id) ?? null;
    }

    function setReloadPromise(p: Promise<unknown>) {
        const id = organization.value?.id ?? null;
        reloadPromises.set(id, p);
        p.catch(console.error).finally(() => {
            reloadPromises.delete(id);
        });
        return p;
    }

    function reload(force = true) {
        const p = getReloadPromise();
        if (p) {
            return p;
        }
        if (organization.value) {
            const manager = new OrganizationManager($context.value!);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            setReloadPromise(
                manager.loadAdmins(force, true, instance?.proxy).catch((e) => {
                    Toast.fromError(e).show();
                    pop({ force: true })?.catch(console.error);
                }),
            );
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            setReloadPromise(
                platformManager.value.loadAdmins(force, true, instance?.proxy).catch((e) => {
                    Toast.fromError(e).show();
                    pop({ force: true })?.catch(console.error);
                }),
            );
        }
    }

    return { reload, reloadPromise: () => getReloadPromise() };
}
