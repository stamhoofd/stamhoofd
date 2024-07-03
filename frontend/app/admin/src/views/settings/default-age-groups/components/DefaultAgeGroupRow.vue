<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ group.name }}
        </h2>

        <p v-if="group.description" class="style-description">
            {{ group.description }}
        </p>

        <p v-if="group.minAge && group.maxAge" class="style-description">
            {{ group.minAge }} - {{ group.maxAge }} jaar
        </p>

        <p v-if="!group.defaultMembershipTypeId" class="style-description">
            Geen automatische aansluiting
        </p>
       
        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { DefaultAgeGroup } from '@stamhoofd/structures';

defineProps<{
    group: DefaultAgeGroup;
}>();

function showContextMenu() {
    // todo
}

</script>
