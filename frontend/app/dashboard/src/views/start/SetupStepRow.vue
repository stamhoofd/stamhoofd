<template>
    <STListItem class="left-center right-stack" :selectable="true" @click="onClick">
        <template #left>
            <IconContainer :class="color" :icon="icon">
                <template #aside>
                    <ProgressIcon v-if="$secondaryIcon || $progress" :icon="$secondaryIcon" :progress="$progress" />
                </template>
            </IconContainer>
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
import { EmailSettingsView, GeneralSettingsView, IconContainer, ProgressIcon, STListItem } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { SetupStep, SetupStepType } from '@stamhoofd/structures';
import { ComponentOptions, computed } from 'vue';
import PremisesView from "../../views/dashboard/settings/PremisesView.vue";
import RegistrationPaymentSettingsView from '../dashboard/settings/RegistrationPaymentSettingsView.vue';
import GroupsReview from './GroupsReview.vue';
import FunctionsReview from './ResponsibilitiesReview.vue';

const props = defineProps<{type: SetupStepType, step: SetupStep}>();

const $navigate = useNavigate();
const organizationManager = useOrganizationManager();
const $isDone = computed(() => props.step.isDone);

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
    if(icon ==='success') return 'success';
    return 'gray';
})

enum Routes {
    Premises = 'gebouwen',
    Groups = 'leeftijdsgroepen',
    Responsibilities = 'functies',
    Companies = 'companies',
    Emails = 'emails',
    Payment = 'payment'
}

const icons: Record<SetupStepType, string> = {
    [SetupStepType.Premises]: 'home',
    [SetupStepType.Groups]: 'group',
    [SetupStepType.Responsibilities]: 'star',
    [SetupStepType.Companies]: 'file-filled',
    [SetupStepType.Emails]: 'email',
    [SetupStepType.Payment]: 'bank'
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
        url: Routes.Payment,
        present: 'popup',
        component: RegistrationPaymentSettingsView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({isReview: true})
    },
    {
        url: Routes.Groups,
        present: 'popup',
        component: GroupsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory()
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: FunctionsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory()
    },
    {
        url: Routes.Emails,
        present: 'popup',
        component: EmailSettingsView as unknown as ComponentOptions,
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
        case SetupStepType.Responsibilities: {
            await $navigate(Routes.Responsibilities);
            break;
        }
        case SetupStepType.Companies: {
            await $navigate(Routes.Companies);
            break;
        }
        case SetupStepType.Emails: {
            await $navigate(Routes.Emails);
            break;
        }
        case SetupStepType.Payment: {
            await $navigate(Routes.Payment);
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
