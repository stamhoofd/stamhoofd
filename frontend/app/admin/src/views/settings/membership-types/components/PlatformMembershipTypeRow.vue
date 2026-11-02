<template>
    <STListItem v-long-press="() => showContextMenu()" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ type.name }}
        </h2>

        <div v-if="type.description.text" class="style-description style-wysiwyg" v-html="type.description.html" />

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PlatformMembershipType } from '@stamhoofd/structures';

defineProps<{
    type: PlatformMembershipType;
}>();

function showContextMenu() {
    // todo
}

</script>
