import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import { Country } from '@stamhoofd/types/Country';
import type { Ref} from 'vue';
import { computed } from 'vue';

export function useCountry(): Ref<Country> {
    return computed(() => I18nController.shared?.countryCode ?? Country.Belgium);
}
