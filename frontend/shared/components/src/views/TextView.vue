<template>
    <component :is="elementName" v-if="text" :class="styleClass">
        {{ text }}
    </component>
</template>

<script setup lang="ts">
import type { TranslatedPlainText } from '@stamhoofd/structures';
import { computed } from 'vue';

/**
 * Plain text never contains a line break, so there is nothing to decide about whitespace here: a text
 * with lines or formatting is a TranslatedRichText and is rendered as html instead.
 */
const props = withDefaults(
    defineProps<{
        value: TranslatedPlainText;
        elementName?: string;
        styleClass?: string;
    }>(), {
        elementName: 'p',
        styleClass: '',
    },
);

const text = computed(() => props.value.toString());
</script>
