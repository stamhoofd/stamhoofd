import { FinancialSupportSettings, Group, Organization, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import { computed, Ref, unref } from 'vue';
import { useAppContext } from '../../context';
import { useOrganization, usePlatform } from '../../hooks';

export function useFinancialSupportSettings(options?: { group?: Ref<Group | null> | Group | null; externalOrganization?: Ref<Organization | null> | Organization | null }) {
    const platform = usePlatform();
    const organization = useOrganization();
    const app = useAppContext();

    const financialSupportSettings = computed(() => platform.value.config.financialSupport ?? FinancialSupportSettings.create({}));
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
