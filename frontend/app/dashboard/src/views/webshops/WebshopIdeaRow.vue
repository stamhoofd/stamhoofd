<template>
    <STListItem class="right-stack smartphone-wrap-left" :selectable="true">
        <h3 class="style-title-list larger">
            <span>{{ idea.name }}</span>
        </h3>
        <p class="style-description-small">
            {{ idea.description }}
        </p>

        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { WebshopIdea } from '@stamhoofd/structures';

defineProps<{
    idea: WebshopIdea;
}>();

</script>
