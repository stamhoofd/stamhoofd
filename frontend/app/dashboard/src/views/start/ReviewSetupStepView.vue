<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main class="center">
            <h1 class="style-navigation-title">
                {{ title }}
            </h1>
            <slot name="top" />
            <ReviewCheckbox :type="type" />
            <slot />
        </main>
    </div>
</template>

<script lang="ts" setup>
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import ReviewCheckbox from './ReviewCheckbox.vue';

const props = defineProps<{type: SetupStepType}>();

const $t = useTranslate();
const title = computed(() => $t(`setup.${props.type}.review.title`));
</script>
