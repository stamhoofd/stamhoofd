import type { EmailInformation } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed, unref } from 'vue';
import { getInvalidEmailDescription } from '../helpers/getInvalidEmailDescription';

export function useEmailWarning(emailInformation: Ref<null | EmailInformation> | null | EmailInformation) {
    return computed(() => {
        const v = unref(emailInformation);
        if (v) {
            return getInvalidEmailDescription(v);
        }
        return null;
    });
}
