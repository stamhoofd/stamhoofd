<template>
    <STListItem :selectable="!disabled" :disabled="disabled" element-name="label">
        <template #left>
            <Radio v-model="model" :disabled="disabled" :value="value" />
        </template>

        <h3 class="style-title-list">
            {{ label }}
        </h3>
        <p v-if="description" class="style-description-small">
            {{ description }}
        </p>

        <slot />

        <template #right>
            <slot name="right" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup generic="T">
import Radio from './Radio.vue';

withDefaults(defineProps<{
    disabled?: boolean;
    label: string;
    description?: string | null;
    value: T;
}>(), {
    disabled: false,
    description: null,
});
const model = defineModel<T>();

</script>
