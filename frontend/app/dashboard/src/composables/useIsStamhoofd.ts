import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { computed } from 'vue';

export default function useIsStamhoofd() {
    const organizationManager = useOrganizationManager();

    return computed(() =>
        organizationManager.value.user.email.endsWith('@stamhoofd.be')
        || organizationManager.value.user.email.endsWith('@stamhoofd.nl'),
    );
}
