import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { defineRoute } from '@simonbackx/vue-app-navigation';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform';
import { usePatchOrganization } from '@stamhoofd/components/organizations/usePatchOrganization';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import { Organization, OrganizationMetaData, OrganizationRecordsConfiguration } from '@stamhoofd/structures';

export function useOrganizationRegistrationRecordSettingsRoute(url: string) {
    const platform = usePlatform();
    const organization = useRequiredOrganization();
    const patchOrganization = usePatchOrganization();

    return defineRoute({
        url,
        present: 'popup',
        component: async () => (await import('@stamhoofd/components/records/RecordsConfigurationView.vue')).default,
        defaultProperties() {
            return {
                inheritedRecordsConfiguration: OrganizationRecordsConfiguration.build({ platform: platform.value }),
                recordsConfiguration: organization.value.meta.recordsConfiguration,
                saveHandler: async (patch: AutoEncoderPatchType<OrganizationRecordsConfiguration>) => {
                    await patchOrganization(Organization.patch({
                        meta: OrganizationMetaData.patch({
                            recordsConfiguration: patch,
                        }),
                    }));
                    Toast.success($t('%HU')).show();
                },
            };
        },
    });
}
