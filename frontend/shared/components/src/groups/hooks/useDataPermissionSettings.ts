import type { Group } from '@stamhoofd/structures';
import { getDataPermissionSettingsOrDefault, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import type { Ref } from 'vue';
import { computed, unref } from 'vue';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';

export function useDataPermissionSettings(options?: {group?: Ref<Group|null>|Group|null}) {
    const platform = usePlatform()
    const organization = useOrganization()

    const dataPermissionSettings = computed(() => getDataPermissionSettingsOrDefault(platform.value, organization.value))
    const recordsConfiguration = computed(() => OrganizationRecordsConfiguration.build({
        platform: platform.value,
        organization: organization.value,
        group: unref(options?.group),
        includeGroup: true
    }))

    return {
        enabled: computed(() => recordsConfiguration.value.dataPermission),
        dataPermissionSettings
    }
}
