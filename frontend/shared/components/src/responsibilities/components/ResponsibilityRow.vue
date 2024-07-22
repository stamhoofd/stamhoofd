<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ responsibility.name }}
        </h2>

        <p v-if="responsibility.organizationTagIds !== null" class="style-description">
            Enkel voor {{ organizationTagIdsDescription }}
        </p>

        <p v-if="responsibility.defaultAgeGroupIds !== null" class="style-description">
            Van {{ defaultAgeGroupIdsDescription }}
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

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components';
import { MemberResponsibility } from '@stamhoofd/structures';
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
    return props.responsibility.defaultAgeGroupIds.map(id => platform.value.config.defaultAgeGroups.find(t => t.id === id)?.name ?? '?').join(', ')
});

</script>
