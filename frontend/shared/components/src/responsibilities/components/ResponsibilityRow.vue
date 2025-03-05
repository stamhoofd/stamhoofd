<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <template #left>
            <span v-if="mergedRole.isEmpty" v-tooltip="'Heeft geen automatische rechten'" class="icon layered">
                <span class="icon user-blocked-layer-1"/>
                <span class="icon user-blocked-layer-2 red"/>
            </span>
            <span v-else-if="mergedRole.hasAccess(PermissionLevel.Full)" class="icon layered">
                <span class="icon user-admin-layer-1"/>
                <span class="icon user-admin-layer-2 yellow"/>
            </span>
            <span v-else class="icon user"/>
        </template>

        <h2 class="style-title-list">
            {{ responsibility.name }}
        </h2>

        <p v-if="responsibility.organizationTagIds !== null" class="style-description">
            {{ $t('876f0d2d-ac9a-4825-8930-2922024f1541') }} {{ organizationTagIdsDescription }}
        </p>

        <p v-if="defaultAgeGroupIdsDescription" class="style-description">
            {{ defaultAgeGroupIdsDescription }}
        </p>

        <p v-if="responsibility.description" class="style-description">
            {{ responsibility.description }}
        </p>

        <p v-if="responsibility.minimumMembers" class="style-description">
            {{ $t('6805286d-d7bb-4a26-8b36-26ec76b8ad3c') }} {{ responsibility.minimumMembers }} {{ $t('c1fc1264-636a-4ec1-916b-b7ce925c7a68') }}
        </p>

        <p v-if="responsibility.maximumMembers" class="style-description">
            {{ $t('3eb28629-8a74-47bf-9a52-5561214e23ff') }} {{ responsibility.maximumMembers }}
        </p>
        <p class="style-description-small">
            {{ $t('c69efe99-92e9-4f56-9d1b-9f47f2dd28a7') }} {{ capitalizeFirstLetter(roleDescription) }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop/>
            <span class="icon arrow-right-small gray"/>
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
    return 'Moet gekoppeld worden aan specifieke lokale leeftijdsgroepen';
});

const mergedRole = computed(() => {
    return LoadedPermissions.fromResponsibility(props.responsibility, props.responsibility.defaultAgeGroupIds !== null ? 'add-fake-group' : null, []);
});

const roleDescription = computed(() => {
    return mergedRole.value.getDescription();
});

</script>
