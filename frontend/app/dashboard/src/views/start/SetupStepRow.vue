<template>
    <STListItem class="left-center right-stack" :selectable="true" @click="onClick">
        <template #left>
            <IconWithProgress :icon="icon" :is-reviewed="$isReviewed" :progress="{
                count: step.finishedSteps,
                total: step.totalSteps
            }"/>
            <!-- <div class="progress-container">
                <IconWithProgress icon="success" :progress="step.progress"/>
                <div v-if="$isDone">
                    <SpinnerWithTransition :is-loading="$saving">
                        <Checkbox :model-value="$isReviewed" :manual="true" :disabled="$saving" @click.stop.prevent="markReviewed" />
                    </SpinnerWithTransition>
                </div>
                <div v-else>
                    <ProgressRing :radius="14" :progress="step.progress" :stroke="3" />
                </div>
            </div> -->
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
import FunctionsReview from './FunctionsReview.vue';
import GroupsReview from './GroupsReview.vue';
import IconWithProgress from './IconWithProgress.vue';

const props = defineProps<{type: SetupStepType, step: SetupStep, saveHandler: (payload: {type: SetupStepType, isReviewed: boolean}) => Promise<void>}>();

const $isReviewed = computed(() => !props.step.shouldBeReviewed);
const $isDone = computed(() => props.step.isDone);
const $navigate = useNavigate();

const $saving = ref(false);

enum Routes {
    Premises = 'gebouwen',
    Groups = 'leeftijdsgroepen',
    Functions = 'functies'
}

const icons: Record<SetupStepType, string> = {
    [SetupStepType.Premises]: 'home',
    [SetupStepType.Groups]: 'group',
    [SetupStepType.Functions]: 'star',
    [SetupStepType.Companies]: 'invoice',
}

const icon = computed(() => icons[props.type]);

defineRoutes([
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView as unknown as ComponentOptions,
    },
    {
        url: Routes.Groups,
        present: 'popup',
        component: GroupsReview as unknown as ComponentOptions,
    },
    {
        url: Routes.Functions,
        present: 'popup',
        component: FunctionsReview as unknown as ComponentOptions,
    }
]);

async function markReviewed() {
    if ($saving.value) {
        return;
    }

    // todo: translate
    const isReviewed = $isReviewed.value;
    const isConfirm = isReviewed ? true : await CenteredMessage.confirm("Ben je zeker dat je deze stap wilt voltooien?", "Voltooi");

    if(isConfirm) {
        $saving.value = true;
        try {
            await props.saveHandler({type: props.type, isReviewed: !isReviewed});
        } catch (e) {
            console.error(e);
        }
        $saving.value = false;
    }
}

async function onClick() {
    switch(props.type) {
        case SetupStepType.Premises: {
            await $navigate(Routes.Premises);
            break;
        }
        case SetupStepType.Groups: {
            await $navigate(Routes.Groups);
            break;
        }
        case SetupStepType.Functions: {
            await $navigate(Routes.Functions);
            break;
        }
    }
}
</script>

<style lang="scss" scoped>
.progress-container {
    width: 28px;
}
</style>
