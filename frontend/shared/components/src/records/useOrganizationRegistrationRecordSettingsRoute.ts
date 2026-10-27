import type { AutoEncoderPatchType } from '@common/encoding';
import { defineRoute } from '@browser/navigation';
import { useRequiredOrganization } from '#hooks/useOrganization';
import { usePlatform } from '#hooks/usePlatform';
import { usePatchOrganization } from '#organizations/usePatchOrganization';
import { Toast } from '#overlays/Toast';
import { Organization, OrganizationMetaData, OrganizationRecordsConfiguration } from '@stamhoofd/structures';

export function useOrganizationRegistrationRecordSettingsRoute(url: string) {
    const platform = usePlatform();
    const organization = useRequiredOrganization();
    const patchOrganization = usePatchOrganization();

    return defineRoute({
        url,
        present: 'popup',
        component: async () => (await import('#records/RecordsConfigurationView.vue')).default,
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
