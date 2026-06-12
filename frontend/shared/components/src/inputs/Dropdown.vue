<template>
    <div class="input-icon-container right icon arrow-down-small gray">
        <select v-model="mappedValue" class="input" :autocomplete="autocomplete" :name="name" :disabled="disabled" :data-testid="dataTestid" @blur="emit('blur', $event)" @focus="emit('focus', $event)">
            <slot />
        </select>
    </div>
</template>

<script lang="ts" setup>
const model = defineModel<any>();

withDefaults(defineProps<{
    autocomplete?: string;
    name?: string;
    disabled?: boolean;
    dataTestid?: string;
}>(), {
    autocomplete: undefined,
    name: undefined,
    disabled: false,
    dataTestid: undefined,
});

const emit = defineEmits<{
    (e: 'blur', event: Event): void;
    (e: 'focus', event: Event): void;
}>();

const mappedValue = model;
</script>
