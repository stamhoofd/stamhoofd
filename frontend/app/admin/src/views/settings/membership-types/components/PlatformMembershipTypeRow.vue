<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ type.name }}
        </h2>

        <p v-if="type.description" class="style-description">
            {{ type.description }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformMembershipType } from '@stamhoofd/structures';

defineProps<{
    type: PlatformMembershipType;
}>();

function showContextMenu() {
    // todo
}

</script>
