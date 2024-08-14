import { FinancialSupportSettings, Group, OrganizationRecordsConfiguration } from "@stamhoofd/structures";
import { computed, Ref, unref } from "vue";
import { useOrganization, usePlatform } from "../../hooks";

export function useFinancialSupportSettings(options?: {group?: Ref<Group|null>|Group|null}) {
    const platform = usePlatform()
    const organization = useOrganization()

    const financialSupportSettings = computed(() => platform.value.config.financialSupport ?? FinancialSupportSettings.create({}) )
    const recordsConfiguration = computed(() => OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: organization.value,
        group: unref(options?.group),
        includeGroup: true
    }))

    return {
        enabled: computed(() => recordsConfiguration.value.financialSupport),
        priceName: computed(() => financialSupportSettings.value.priceName),
        financialSupportSettings
    }
}
