import { FinancialSupportSettings, Group, OrganizationRecordsConfiguration } from "@stamhoofd/structures";
import { computed, Ref, unref } from "vue";
import { useAppContext } from "../../context";
import { useOrganization, usePlatform } from "../../hooks";

export function useFinancialSupportSettings(options?: {group?: Ref<Group|null>|Group|null}) {
    const platform = usePlatform()
    const organization = useOrganization()
    const group = unref(options?.group);

    const financialSupportSettings = computed(() => platform.value.config.financialSupport ?? FinancialSupportSettings.create({}) )
    const recordsConfiguration = computed(() => OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: organization.value,
        group,
        includeGroup: true
    }))

    let enabled = computed(() => recordsConfiguration.value.financialSupport);

    if(!group) {
        if(useAppContext() === 'admin') {
            enabled = computed(() => true)
        }
    }

    return {
        enabled,
        priceName: computed(() => financialSupportSettings.value.priceName),
        financialSupportSettings
    }
}
