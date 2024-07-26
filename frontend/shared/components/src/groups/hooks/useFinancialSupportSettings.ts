import { FinancialSupportSettings } from "@stamhoofd/structures";
import { computed } from "vue";
import { useOrganization, usePlatform } from "../../hooks";

export function useFinancialSupportSettings() {
    const organinization = useOrganization();
    const platform = usePlatform()
    const financialSupport = computed(() => platform.value.config.recordsConfiguration.financialSupport ?? organinization.value?.meta.recordsConfiguration.financialSupport ?? null )

    return {
        enabled: computed(() => financialSupport.value !== null),
        priceName: computed(() => financialSupport.value?.priceName ?? FinancialSupportSettings.defaultPriceName)
    }
}
