<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ type.title }}
        </h2>
        <p class="style-description-small">
            {{ type.description }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { EventNotificationType } from '@stamhoofd/structures';

defineProps<{
    type: EventNotificationType;
}>();

</script>
