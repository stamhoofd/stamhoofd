import type { Organization } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed } from 'vue';
import { useContext } from './useContext';

/** During setup, read the context's organization as a computed ref; null means no organization scope. */
export function useOrganization(): Ref<Organization | null> {
    const context = useContext();
    return computed(() => context.value.organization);
}

/** Only for organization-scoped views: asserts the type, but does not validate or load an organization at runtime. */
export function useRequiredOrganization(): Ref<Organization> {
    const context = useContext();
    return computed(() => context.value.organization!);
}
