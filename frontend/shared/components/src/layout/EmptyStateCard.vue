<template>
    <div class="empty-state-card">
        <IconContainer :icon="icon" class="gray" />
        <h3 class="style-title-list">
            {{ title }}
        </h3>
        <p v-if="description" class="style-description-small">
            {{ description }}
        </p>
        <div v-if="$slots.default" class="empty-state-actions">
            <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
import IconContainer from '../icons/IconContainer.vue';

/**
 * Explains an empty list and offers the action that fills it. Buttons go in the default slot.
 * Has no frame of its own: wrap it in an STCard where a card fits.
 */
withDefaults(defineProps<{
    icon: string;
    title: string;
    description?: string;
}>(), {
    description: '',
});
</script>

<style lang="scss" scoped>
.empty-state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 5px;
    padding: 15px 0;

    > .style-image-with-icon {
        margin-bottom: 5px;
    }

    > p {
        max-width: 420px;
    }
}

.empty-state-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding-top: 5px;
}
</style>
