<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ responsibility.name }} <template v-if="group">
                van {{ group.settings.name }}
            </template>
        </h2>
        <p class="style-description-small">{{ capitalizeFirstLetter(roleDescription) }}</p>
       
        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components';
import { Group, LoadedPermissions, MemberResponsibility, PermissionRoleForResponsibility } from '@stamhoofd/structures';
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
