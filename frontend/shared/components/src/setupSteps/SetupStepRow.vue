<template>
    <STListItem class="left-center right-stack" :selectable="isSelectable">
        <template #left>
            <IconContainer :class="color" :icon="icon">
                <template #aside>
                    <ProgressIcon v-if="$secondaryIcon || $progress" :icon="$secondaryIcon" :progress="$progress" />
                </template>
            </IconContainer>
        </template>
        <h2 class="style-title-list">
            {{ title }}
        </h2>
        <p v-if="listType === 'todo'" class="style-description">
            {{ description }}
        </p>
        <p v-else class="style-description-small">
            {{ reviewDescription }}
        </p>
        <template #right>
            <span v-if="!step.isDone" class="style-description-small">{{ step.finishedSteps }} / {{ step.totalSteps }}</span>
            <span v-if="isSelectable" class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script setup lang="ts">
import { IconContainer, ProgressIcon, STListItem, useSetupStepReviewDescription, useSetupStepTranslations } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SetupStep, SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    setupStepType: SetupStepType;
    step: SetupStep;
    listType: 'review' | 'todo';
}>();

const setupStepTranslations = useSetupStepTranslations();

const { getDescription: getReviewDescription } = useSetupStepReviewDescription();

const isSelectable = computed(() => props.listType === 'todo');
const title = computed(() => $isDone.value ? setupStepTranslations.getReviewTitle(props.setupStepType) : setupStepTranslations.getTodoTitle(props.setupStepType));
const description = computed(() => $isDone.value ? setupStepTranslations.getReviewDescription(props.setupStepType) : setupStepTranslations.getTodoDescription(props.setupStepType));
const reviewDescription = computed(() => {
    const step = props.step;
    const textIfNotReviewed = $t('c75d45e6-b741-462b-899e-56a41e10918a');

    if (step.isDone) {
        return getReviewDescription(step.review, true, $t('586cb220-498a-496a-8db5-89a4f10ba3df'));
    }

    return textIfNotReviewed;
});

const $isDone = computed(() => props.step.isDone);

const $progress = computed(() => {
    // do not show progress if step is done
    if ($isDone.value) return undefined;
    return props.step.progress;
});

const $secondaryIcon = computed(() => {
    if (props.step.isComplete) {
        return 'success';
    }
    return undefined;
});

const color = computed(() => {
    const icon = $secondaryIcon.value;
    if (icon === 'success') return 'success';
    return 'gray';
});

const icons: Record<SetupStepType, string> = {
    [SetupStepType.Premises]: 'home',
    [SetupStepType.Groups]: 'group',
    [SetupStepType.Responsibilities]: 'star',
    [SetupStepType.Companies]: 'file-filled',
    [SetupStepType.Emails]: 'email',
    [SetupStepType.Payment]: 'bank',
    [SetupStepType.Registrations]: 'edit',
};

const icon = computed(() => icons[props.setupStepType]);
</script>

<style lang="scss" scoped>
.progress-container {
    width: 28px;
}
</style>
