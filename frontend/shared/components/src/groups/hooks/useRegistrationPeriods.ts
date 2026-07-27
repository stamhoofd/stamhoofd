import { useAllRegistrationPeriods, useFetchAllRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchRegistrationPeriods';
import type { Ref} from 'vue';
import { computed, onMounted, unref } from 'vue';
import { Toast } from '../../overlays/Toast';

export function useRegistrationPeriods() {
    const fetchPeriods = useFetchAllRegistrationPeriods()
    const periods = useAllRegistrationPeriods()

    onMounted(async () => {
        try {
            await fetchPeriods({ shouldRetry: true, force: true })
        } catch (e) {
            Toast.fromError(e).show()
        }
    });

    return {
        loading: computed(() => !periods.value),
        periods: computed(() => periods.value),
    }
}

export function useRegistrationPeriod(id: Ref<string>|string) {
    const periods = useRegistrationPeriods()
    return computed(() => periods.periods.value?.find(p => p.id == unref(id)) ?? null)
}   
