<template>
    <STListItem :selectable="!disabled" element-name="label">
        <template #left>
            <Checkbox v-model="model" :disabled="disabled" />
        </template>

        <h3 class="style-title-list">
            {{ label }}
        </h3>
        <p v-if="description" class="style-description-small">
            {{ description }}
        </p>

        <slot />
    </STListItem>
</template>

<script lang="ts" setup>

withDefaults(defineProps<{
    disabled?: boolean;
    label: string;
    description?: string | null;
}>(), {
    disabled: false,
    description: null,
});
const model = defineModel<boolean>();

</script>
