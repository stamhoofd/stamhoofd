import { STPackage, STPackageType } from '@stamhoofd/structures';
import { ref, Ref } from 'vue';
import { useOrganizationPackages } from './useOrganizationPackages';
import { Toast, useContext } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';

/**
 * Not sure if still required
 */
export function useDeactivatePackageType() {
    const { loadIfMissing, packages, reload } = useOrganizationPackages();
    const { deactivate } = useDeactivatePackage();
    const context = useContext();
    const isDeactivatingPackageType = ref(null) as Ref<STPackageType | null>;

    async function deactivateType(packageType: STPackageType, message: string) {
        if (isDeactivatingPackageType.value) {
            return;
        }
        isDeactivatingPackageType.value = packageType;

        try {
            await loadIfMissing();
            const pack = packages.value?.packages.find(p => p.meta.type === packageType);

            if (pack) {
                return await deactivate(pack, message);
            }
            else {
                // Force reload of packages
                await reload();
                const pack = packages.value?.packages.find(p => p.meta.type === packageType);

                if (pack) {
                    return await deactivate(pack, message);
                }
                else {
                    // Force organization update
                    await context.value.fetchOrganization(false);
                }
            }
        }
        catch (e) {
            Toast.fromError(e).show();
        }
        isDeactivatingPackageType.value = null;
    }

    return {
        deactivateType,
        isDeactivatingPackageType,
    };
}

export function useDeactivatePackage() {
    const isDeactivatingPackage = ref(null) as Ref<STPackage | null>;
    const context = useContext();
    const owner = useRequestOwner();
    const { reload } = useOrganizationPackages();

    async function deactivate(pack: STPackage, message: string) {
        if (isDeactivatingPackage.value) {
            return;
        }
        isDeactivatingPackage.value = pack;

        try {
            await context.value.authenticatedServer.request({
                method: 'POST',
                path: '/billing/deactivate-package/' + pack.id,
                owner,
                shouldRetry: false,
            });
            await context.value.fetchOrganization(false);
            await reload();
            Toast.success(message).show();
        }
        catch (e) {
            Toast.fromError(e).show();
        }

        isDeactivatingPackage.value = null;
    }

    return {
        deactivate,
        isDeactivatingPackage,
    };
}
