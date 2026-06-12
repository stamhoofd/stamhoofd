<template>
    <MultipleChoiceInput
        v-model="model"
        :items="eventTypes.map(type => ({ name: type.name, value: type.id }))"
        :nullable="nullable"
        :nullable-label="$t('%8o')"
    />
</template>

<script setup lang="ts">
import { useEventTypes } from '#hooks/useEventTypes.ts';
import MultipleChoiceInput from './MultipleChoiceInput.vue';

withDefaults(
    defineProps<{
        nullable?: boolean;
    }>(), {
        nullable: false,
    },
);

const model = defineModel<string[] | null>({ required: true });

const eventTypes = useEventTypes();
</script>
