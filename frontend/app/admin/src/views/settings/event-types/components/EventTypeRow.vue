<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ type.name }}
        </h2>
        <div v-if="type.description.text" class="style-description-small style-wysiwyg" v-html="type.description.html" />

        <p v-if="type.maximum !== null" class="style-description-small">
            {{ $t('%6W', { aantal: type.maximum.toFixed() }) }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PlatformEventType } from '@stamhoofd/structures';

defineProps<{
    type: PlatformEventType;
}>();

</script>
