<template>
    <STListItem class="left-center right-stack" :selectable="true" @click="onClick">
        <template #left>
            <div class="progress-container">
                <Checkbox v-if="$isDone" :model-value="$isReviewed" :manual="true" :disabled="$saving" @click.stop.prevent="markReviewed" />
                <div v-else>
                    <ProgressRing :radius="14" :progress="step.progress" :stroke="3" />
                </div>
            </div>
        </template>
        <h2 class="style-title-list">
            {{ $isDone ? $t(`setup.${props.type}.review.title`) : $t(`setup.${props.type}.todo.title`) }}
        </h2>
        <p class="style-description">
            {{ $isDone ? $t(`setup.${props.type}.review.description`) : $t(`setup.${props.type}.todo.description`) }}
        </p>
        <template #right>
            <span v-if="!step.isDone" class="style-description-small">{{ step.finishedSteps }} / {{ step.totalSteps }}</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>


<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, STListItem } from '@stamhoofd/components';
import { SetupStep, SetupStepType } from '@stamhoofd/structures';
import { ComponentOptions, computed, ref } from 'vue';
import PremisesView from "../../views/dashboard/settings/PremisesView.vue";
import ProgressRing from './ProgressRing.vue';

const props = defineProps<{type: SetupStepType, step: SetupStep}>();
const emits = defineEmits<{(e: 'review', isReviewed: boolean): void}>();

const $isReviewed = computed(() => !props.step.shouldBeReviewed);
const $isDone = computed(() => props.step.isDone);
const $navigate = useNavigate();

const $saving = ref(false);

enum Routes {
    Premises = 'gebouwen',
}

defineRoutes([
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView as unknown as ComponentOptions,
    }
]);

async function markReviewed() {
    if ($saving.value) {
        return;
    }

    // todo: translate
    const isReviewed = $isReviewed.value;
    const isConfirm = isReviewed ? true : await CenteredMessage.confirm("Ben je zeker dat je deze stap wilt voltooien?", "Voltooi", "De stap zal niet meer worden weergegeven bij het herladen van de pagina.");

    if(isConfirm) {
        $saving.value = true;
        try {
            emits('review', !isReviewed);
        } catch (e) {
            console.error(e);
        }
        $saving.value = false;
    }
}

async function onClick() {
    switch(props.type) {
        case SetupStepType.Premises: {
            await $navigate(Routes.Premises)
        }
    }
}
</script>

<style lang="scss" scoped>
.progress-container {
    width: 28px;
}
</style>
