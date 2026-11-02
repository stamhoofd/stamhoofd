<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ type.name }}
        </h2>
        <div v-if="type.description.text" class="style-description-small style-wysiwyg" v-html="type.description.html" />

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import type { PlatformPremiseType } from '@stamhoofd/structures';

defineProps<{
    type: PlatformPremiseType;
}>();
</script>
