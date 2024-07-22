<template>
    <STListItem :selectable="true" class="right-stack">
        <template #left>
            <span class="icon layered" v-if="mergedRole.hasAccess(PermissionLevel.Full)">
                <span class="icon user-admin-layer-1" />
                <span class="icon user-admin-layer-2 yellow" />
            </span>
            <span v-else-if="mergedRole.isEmpty" v-tooltip="'Heeft geen rol'" class="icon layered">
                <span class="icon user-blocked-layer-1" />
                <span class="icon user-blocked-layer-2 red" />
            </span>
            <span v-else class="icon user" />
        </template>
        
        <h2 class="style-title-list">
            {{ responsibility.name }} <template v-if="group">
                van {{ group.settings.name }}
            </template>
        </h2>
        <p class="style-description-small">{{ responsibility.description }}</p>

        <p class="style-description-small">Rechten: {{ capitalizeFirstLetter(roleDescription) }}</p>
       
        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components';
import { Group, LoadedPermissions, MemberResponsibility, PermissionLevel, PermissionRoleForResponsibility } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    responsibility: MemberResponsibility;
    group: Group|null;
    role: PermissionRoleForResponsibility|null;
}>();
const platform = usePlatform();

const mergedRole = computed(() => {
    return LoadedPermissions.buildRoleForResponsibility(props.group?.id ?? null, props.responsibility, props.role ? [props.role] : []);
});

const roleDescription = computed(() => {
    return mergedRole.value.getDescription()
});

</script>
