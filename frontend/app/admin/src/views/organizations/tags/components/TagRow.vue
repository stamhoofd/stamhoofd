<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ tag.name }}
        </h2>
       
        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { OrganizationTag } from '@stamhoofd/structures';

defineProps<{
    tag: OrganizationTag;
}>();

function showContextMenu() {
    // todo
}

</script>
