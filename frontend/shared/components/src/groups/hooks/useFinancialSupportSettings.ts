import type { Group, Organization } from '@stamhoofd/structures';
import { getFinancialSupportSettingsOrDefault, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, unref } from 'vue';
import { useAppContext } from '#context/appContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';

export function useFinancialSupportSettings(options?: { group?: Ref<Group | null> | Group | null; externalOrganization?: Ref<Organization | null> | Organization | null }) {
    const platform = usePlatform();
    const organization = useOrganization();
    const app = useAppContext();

    const financialSupportSettings = computed(() => getFinancialSupportSettingsOrDefault(platform.value, organization.value));
    const recordsConfiguration = computed(() => OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: options?.externalOrganization ? unref(options.externalOrganization) : organization.value,
        group: unref(options?.group),
        includeGroup: true,
    }));

    return {
        enabled: computed(() => {
            const group = unref(options?.group);
            if (!group) {
                if (app === 'admin') {
                    return true;
                }
            }

            return recordsConfiguration.value.financialSupport;
        }),
        priceName: computed(() => financialSupportSettings.value.priceName),
        financialSupportSettings,
    };
}
