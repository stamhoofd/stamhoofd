<template>
    <STListItem :selectable="true" class="right-stack">
        <template #left>
            <span v-if="mergedRole.hasAccess(PermissionLevel.Full)" class="icon layered">
                <span class="icon user-admin-layer-1" />
                <span class="icon user-admin-layer-2 yellow" />
            </span>
            <span v-else-if="mergedRole.isEmpty" class="icon layered" :v-tooltip="$t('3bb4e938-ca4e-4318-a86d-002ba6035fd0')">
                <span class="icon user-blocked-layer-1" />
                <span class="icon user-blocked-layer-2 red" />
            </span>
            <span v-else class="icon user" />
        </template>

        <h2 class="style-title-list">
            {{ responsibility.name }} <template v-if="group">
                {{ $t('e9ec956f-3a71-4460-b09d-dfec22a1aaf0') }} {{ group.settings.name }}
            </template>
        </h2>
        <p class="style-description-small">
            {{ responsibility.description }}
        </p>

        <p class="style-description-small">
            {{ $t('52acb4e7-fb83-4406-8119-9adbda0ecc22') }}: {{ capitalizeFirstLetter(roleDescription) }}
        </p>

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
    group: Group | null;
    role: PermissionRoleForResponsibility | null;
}>();
const platform = usePlatform();

const mergedRole = computed(() => {
    return LoadedPermissions.fromResponsibility(props.responsibility, props.group?.id ?? null, props.role ? [props.role] : []);
});

const roleDescription = computed(() => {
    return mergedRole.value.getDescription();
});

</script>
