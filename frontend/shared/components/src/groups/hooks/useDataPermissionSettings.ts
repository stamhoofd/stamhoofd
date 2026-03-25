import type { Group} from '@stamhoofd/structures';
import { DataPermissionsSettings, OrganizationRecordsConfiguration } from '@stamhoofd/structures';
import type { Ref} from 'vue';
import { computed, unref } from 'vue';
import { useOrganization, usePlatform } from '../../hooks';

export function useDataPermissionSettings(options?: {group?: Ref<Group|null>|Group|null}) {
    const platform = usePlatform()
    const organization = useOrganization()

    const dataPermissionSettings = computed(() => platform.value.config.dataPermission ?? DataPermissionsSettings.create({}) )
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
