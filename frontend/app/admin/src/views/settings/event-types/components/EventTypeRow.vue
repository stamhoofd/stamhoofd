<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ type.name }}
        </h2>
        <p class="style-description-small">
            {{ type.description }}
        </p>

        <p v-if="type.maximum !== null" class="style-description-small">
            {{ $t('Maximum {aantal} activiteiten per jaar', { aantal: type.maximum.toFixed() }) }}
        </p>

        <template #right>
            <span class="button icon drag gray" @click.stop @contextmenu.stop />
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { PlatformEventType } from '@stamhoofd/structures';

defineProps<{
    type: PlatformEventType
}>();


</script>
