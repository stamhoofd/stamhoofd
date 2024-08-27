<template>
    <STListItem class="left-center right-stack" :selectable="true" @click="onClick">
        <template #left>
            <IconContainer :class="color" :icon="icon">
                <template #aside>
                    <ProgressIcon v-if="$secondaryIcon || $progress" :icon="$secondaryIcon" :progress="$progress" />
                </template>
            </IconContainer>
            <IconContainer :class="color" :icon="icon">
                <template #aside>
                    <ProgressIcon v-if="$secondaryIcon || $progress" :icon="$secondaryIcon" :progress="$progress" />
                </template>
            </IconContainer>
        </template>
        <h2 class="style-title-list">
            {{ $isDone ? $t(`setup.${props.type}.review.checkboxTitle`) : $t(`setup.${props.type}.todo.checkboxTitle`) }}
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
import { GeneralSettingsView, IconContainer, ProgressIcon, STListItem } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { SetupStep, SetupStepType } from '@stamhoofd/structures';
import { ComponentOptions, computed } from 'vue';
import PremisesView from "../../views/dashboard/settings/PremisesView.vue";
import FunctionsReview from './FunctionsReview.vue';
import GroupsReview from './GroupsReview.vue';

const props = defineProps<{type: SetupStepType, step: SetupStep}>();

const $navigate = useNavigate();
const organizationManager = useOrganizationManager();
const $isDone = computed(() => props.step.isDone);
const $progress = computed(() => {
    // do not show progress if step is done
    if($isDone.value) return undefined;
    return props.step.progress;
});
const $progress = computed(() => {
    // do not show progress if step is done
    if($isDone.value) return undefined;
    return props.step.progress;
});

const $secondaryIcon = computed(() => {
    if(props.step.isComplete) {
        return 'success';
    }
    return undefined;
})

const color = computed(() => {
    const icon = $secondaryIcon.value;
    if(icon ==='success') return 'blue';
    return 'gray';
})

enum Routes {
    Premises = 'gebouwen',
    Groups = 'leeftijdsgroepen',
    Functions = 'functies',
    Companies = 'companies'
}

const icons: Record<SetupStepType, string> = {
    [SetupStepType.Premises]: 'home',
    [SetupStepType.Groups]: 'group',
    [SetupStepType.Functions]: 'star',
    [SetupStepType.Companies]: 'file-filled',
}

const icon = computed(() => icons[props.type]);

function paramToPropsFactory(record: Record<string, unknown> = {}): () => Promise<Record<string, unknown>> {
    return async () => {
        await forceUpdateOrganization();
        return record;
    }
}

defineRoutes([
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({isReview: true})
    },
    {
        url: Routes.Companies,
        present: 'popup',
        component: GeneralSettingsView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({isReview: true})
    },
    {
        url: Routes.Groups,
        present: 'popup',
        component: GroupsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory()
    },
    {
        url: Routes.Functions,
        present: 'popup',
        component: FunctionsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory()
    }
]);

let shouldUpdateOrganization = false;

async function forceUpdateOrganization() {
    if (shouldUpdateOrganization) {
        try {
            await organizationManager.value.forceUpdate();
        } catch (error) {
            console.error(error);
        }
    }
    shouldUpdateOrganization = false;
}

async function onClick() {
    shouldUpdateOrganization = true;

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
        case SetupStepType.Companies: {
            await $navigate(Routes.Companies);
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
