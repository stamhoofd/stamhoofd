import { I18nController } from "@stamhoofd/frontend-i18n";
import { Country } from "@stamhoofd/structures";
import { Ref, computed } from "vue";

export function useCountry(): Ref<Country> {
    return computed(() => I18nController.shared?.country ?? Country.Belgium)
}
