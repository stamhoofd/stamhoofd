<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <template #left>
            <span v-if="mergedRole.isEmpty" v-tooltip="'Heeft geen rol'" class="icon layered">
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
            Enkel voor {{ organizationTagIdsDescription }}
        </p>

        <p v-if="defaultAgeGroupIdsDescription" class="style-description">
            {{ defaultAgeGroupIdsDescription }}
        </p>

        <p v-if="responsibility.description" class="style-description">
            {{ responsibility.description }}
        </p>

        <p v-if="responsibility.minimumMembers" class="style-description">
            Minimum {{ responsibility.minimumMembers }} vereist
        </p>
        
        <p v-if="responsibility.maximumMembers" class="style-description">
            Maximum {{ responsibility.maximumMembers }}
        </p>
        <p class="style-description-small">Rechten: {{ capitalizeFirstLetter(roleDescription) }}</p>

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
        return ''
    }
    return props.responsibility.organizationTagIds.map(id => platform.value.config.tags.find(t => t.id === id)?.name ?? '?').join(', ')
});

const defaultAgeGroupIdsDescription = computed(() => {
    if (props.responsibility.defaultAgeGroupIds === null) {
        return ''
    }
    return 'Moet gekoppeld worden aan specifieke lokale leeftijdsgroepen'
});

const mergedRole = computed(() => {
    return LoadedPermissions.buildRoleForResponsibility(props.responsibility.defaultAgeGroupIds !== null ? 'add-fake-group' : null, props.responsibility, []);
});

const roleDescription = computed(() => {
    return mergedRole.value.getDescription()
});

</script>
