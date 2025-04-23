<template>
    <span v-if="getResponsibilityMergedRole(responsibility, group?.id).isEmpty" class="icon layered" :v-tooltip="$t('973b8b5e-9c84-4e86-aae8-da7ae1a1ad6a')">
        <span class="icon user-blocked-layer-1" />
        <span class="icon user-blocked-layer-2 red" />
    </span>
    <span v-else-if="getResponsibilityMergedRole(responsibility, group?.id).hasAccess(PermissionLevel.Full)" class="icon layered">
        <span class="icon user-admin-layer-1" />
        <span class="icon user-admin-layer-2 yellow" />
    </span>
    <span v-else class="icon user" />
</template>

<script lang="ts" setup>
import { Group, LoadedPermissions, MemberResponsibility, Organization, PermissionLevel } from '@stamhoofd/structures';

const props = withDefaults(
    defineProps<{
        responsibility: MemberResponsibility;
        group?: Group | null;
        organization?: Organization | null;
    }>(), {
        group: null,
        organization: null,
    },
);

function getResponsibilityMergedRole(responsibility: MemberResponsibility, groupId: string | null | undefined) {
    return LoadedPermissions.fromResponsibility(responsibility, groupId ?? null, props.organization?.privateMeta?.inheritedResponsibilityRoles ?? []);
}

</script>
