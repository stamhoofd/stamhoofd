<template>
    <STListItem v-long-press="(e: any) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <template #left>
            <span v-if="mergedRole.isEmpty" class="icon layered" :v-tooltip="$t('973b8b5e-9c84-4e86-aae8-da7ae1a1ad6a')">
                <span class="icon user-blocked-layer-1" />
                <span class="icon user-blocked-layer-2 red" />
            </span>
            <span v-else-if="mergedRole.hasAccess(PermissionLevel.Full)" class="icon layered">
                <span class="icon user-admin-layer-1" />
                <span class="icon user-admin-layer-2 yellow" />
            </span>
            <span v-else class="icon user" />
        </template>

        <h2 class="style-title-list">
            {{ responsibility.name }}
        </h2>

        <p v-if="responsibility.organizationTagIds !== null" class="style-description">
            {{ $t('925249f2-cdcb-4db8-be29-030b35bd816e', {organization: organizationTagIdsDescription}) }}
        </p>

        <p v-if="defaultAgeGroupIdsDescription" class="style-description">
            {{ defaultAgeGroupIdsDescription }}
        </p>

        <p v-if="responsibility.description" class="style-description">
            {{ responsibility.description }}
        </p>

        <p v-if="responsibility.minimumMembers" class="style-description">
            {{ $t('53f798cf-f2d0-4a3b-ad26-c5d67af71343', {min: responsibility.minimumMembers.toString()}) }}
        </p>

        <p v-if="responsibility.maximumMembers" class="style-description">
            {{ $t('6dde271d-4108-48ce-a433-4ad80478c4ef', {max: responsibility.maximumMembers.toString()}) }}
        </p>
        <p class="style-description-small">
            {{ $t('52acb4e7-fb83-4406-8119-9adbda0ecc22') }}: {{ capitalizeFirstLetter(roleDescription) }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components';
import { LoadedPermissions, MemberResponsibility, PermissionLevel } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    responsibility: MemberResponsibility;
}>();
const platform = usePlatform();

function showContextMenu() {
    // todo
}

const organizationTagIdsDescription = computed(() => {
    if (props.responsibility.organizationTagIds === null) {
        return '';
    }
    return props.responsibility.organizationTagIds.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? '?').join(', ');
});

const defaultAgeGroupIdsDescription = computed(() => {
    if (props.responsibility.defaultAgeGroupIds === null) {
        return '';
    }
    return $t(`67ff4ca3-6f9e-4f74-92f7-ea63acfdb3b8`);
});

const mergedRole = computed(() => {
    return LoadedPermissions.fromResponsibility(props.responsibility, props.responsibility.defaultAgeGroupIds !== null ? 'add-fake-group' : null, []);
});

const roleDescription = computed(() => {
    return mergedRole.value.getDescription();
});

</script>
