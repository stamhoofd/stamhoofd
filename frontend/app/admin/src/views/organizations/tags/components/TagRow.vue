<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" :class="{'hover-box': showDelete}" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ tag.name }}
        </h2>

        <template #right>
            <span v-if="showDelete" class="icon trash gray hover-show" @click.stop="emits('delete')" />
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { OrganizationTag } from '@stamhoofd/structures';

withDefaults(defineProps<{
    tag: OrganizationTag;
    showDelete?: boolean;
}>(), {
    showDelete: false,
});

const emits = defineEmits<{ (e: 'delete'): void }>();

function showContextMenu() {
    // todo
}

</script>
