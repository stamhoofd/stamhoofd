<template>
    <div class="st-view">
        <STNavigationBar :title="title" />
        <main class="center">
            <h1>
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
import { useOrganization } from '@stamhoofd/components';

const props = defineProps<{type: SetupStepType}>();

const organization$ = useOrganization();
const step = computed(() => organization$.value?.period.setupSteps.get(props.type));
const $isDone = computed(() => step.value?.isDone);

const $t = useTranslate();
const title = computed(() => $isDone.value ? $t(`setup.${props.type}.review.title`) : $t(`setup.${props.type}.todo.title`));
</script>
