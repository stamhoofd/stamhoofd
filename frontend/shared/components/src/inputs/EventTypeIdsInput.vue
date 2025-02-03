<template>
    <MultipleChoiceInput
        v-model="model"
        :items="eventTypes.map(type => ({ name: type.name, value: type.id }))"
        :nullable="nullable"
        :nullable-label="$t('bd1ba739-5402-42ec-abef-9d45ed31d556')"
    />
</template>

<script setup lang="ts">
import { usePlatform } from '@stamhoofd/components';
import { computed } from 'vue';
import MultipleChoiceInput from './MultipleChoiceInput.vue';

withDefaults(
    defineProps<{
        nullable?: boolean;
    }>(), {
        nullable: false,
    },
);

const model = defineModel<string[] | null>({ required: true });
const platform = usePlatform();
const eventTypes = computed(() => platform.value.config.eventTypes);
</script>
