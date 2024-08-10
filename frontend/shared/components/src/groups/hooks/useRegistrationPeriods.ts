import { usePlatformManager, useRequestOwner } from "@stamhoofd/networking";
import { computed, onMounted, Ref, unref } from "vue";
import { Toast } from "../../overlays/Toast";

export function useRegistrationPeriods() {
    const platformManager = usePlatformManager()
    const owner = useRequestOwner()

    onMounted(async () => {
        try {
            await platformManager.value.loadPeriods(true, true, owner)
        } catch (e) {
            Toast.fromError(e).show()
        }
    });

    return {
        loading: computed(() => !platformManager.value.$platform.periods),
        periods: computed(() => platformManager.value.$platform.periods),
    }
}   

export function useRegistrationPeriod(id: Ref<string>|string) {
    const periods = useRegistrationPeriods()
    return computed(() => periods.periods.value?.find(p => p.id == unref(id)) ?? null)
}   
