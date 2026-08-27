import type { PlatformMember } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed } from 'vue';
import { useOrganization } from '../../hooks/useOrganization';
import { usePlatform } from '../../hooks/usePlatform';

/**
 * Only show the language of a member when it can differ from the default: on multilingual platforms
 * and organizations, or when the member already has a language that differs from the default.
 */
export function useShowMemberLanguage(member: Ref<PlatformMember>) {
    const platform = usePlatform();
    const contextOrganization = useOrganization();

    return computed(() => {
        const organization = contextOrganization.value ?? member.value.organizations[0] ?? null;
        const organizationLanguage = organization?.language ?? null;

        if (organization ? (organizationLanguage === null) : (platform.value.language === null)) {
            // Multi lingual mode
            return true;
        }

        if (member.value.patchedMember.details.language === null) {
            return false;
        }

        const defaultLanguage = organizationLanguage ?? platform.value.language;
        return member.value.patchedMember.details.language !== defaultLanguage;
    });
}
