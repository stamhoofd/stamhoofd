<template>
    <template v-if="$setupSteps && !$setupSteps.isEmpty()">
        <TransitionFade>
            <p v-if="$areAllComplete && !$overrideShowSteps" key="done" class="success-box selectable with-button" @click="showSteps">
                {{ $t('a654551b-6dcd-48a9-a5c5-4609fdcba5f3') }}

                <button class="button text" type="button">
                    {{ $t('72f84037-1626-49e6-ab24-c657a51266a5') }}
                </button>
            </p>
            <div v-else key="steps" class="container">
                <hr><h2>{{ $t('8e77d1c1-87dc-4fdb-ad6e-13145bc96f78') }}</h2>
                <p>{{ $t('cd60d49f-9fc8-4fb7-b574-1231874c1d43') }} <a :href="$domains.getDocs('vlagmoment')" class="inline-link" target="_blank">{{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}</a></p>
                <SetupStepRows :steps="$setupSteps" list-type="todo" @select="onClickStep" />
            </div>
        </TransitionFade>
    </template>
    <template v-else>
        <p v-if="organization$?.period.period.id !== platform.period.id" class="info-box">
            {{ $t('ab0c7981-0d5f-4c36-bd3f-07ddc2a63759') }}
        </p>
    </template>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { EmailSettingsView, GeneralSettingsView, GlobalEventBus, SetupStepRows, TransitionFade, useOrganization, usePlatform, useVisibilityChange } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { SetupStepType } from '@stamhoofd/structures';
import { ComponentOptions, computed, onActivated, ref } from 'vue';
import PremisesView from '../../views/dashboard/settings/PremisesView.vue';
import RegistrationPaymentSettingsView from '../dashboard/settings/RegistrationPaymentSettingsView.vue';
import GroupsReview from './GroupsReview.vue';
import FunctionsReview from './ResponsibilitiesReview.vue';

const organization$ = useOrganization();
const platform = usePlatform();
const organizationManager = useOrganizationManager();
const $navigate = useNavigate();

const $overrideShowSteps = ref(false);
const $setupSteps = computed(() => organization$.value?.period.setupSteps);
const $areAllComplete = computed(() => $setupSteps.value?.areAllComplete() ?? false);

onActivated(() => forceUpdateOrganization());
useVisibilityChange(() => forceUpdateOrganization());

async function forceUpdateOrganization() {
    await organizationManager.value.forceUpdate();
}

function showSteps() {
    $overrideShowSteps.value = true;
}

function paramToPropsFactory(record: Record<string, unknown> = {}): () => Promise<Record<string, unknown>> {
    return async () => {
        if (shouldUpdateOrganization) {
            try {
                await forceUpdateOrganization();
            }
            catch (error) {
                console.error(error);
            }
        }
        shouldUpdateOrganization = false;
        return record;
    };
}

enum Routes {
    Premises = 'lokalen',
    Groups = 'leeftijdsgroepen',
    Responsibilities = 'functies',
    Companies = 'companies',
    Emails = 'emails',
    Payment = 'payment',
}

defineRoutes([
    {
        url: Routes.Premises,
        present: 'popup',
        component: PremisesView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Companies,
        present: 'popup',
        component: GeneralSettingsView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Payment,
        present: 'popup',
        component: RegistrationPaymentSettingsView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Groups,
        present: 'popup',
        component: GroupsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory(),
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: FunctionsReview as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory(),
    },
    {
        url: Routes.Emails,
        present: 'popup',
        component: EmailSettingsView as unknown as ComponentOptions,
        paramsToProps: paramToPropsFactory(),
    },
]);

let shouldUpdateOrganization = false;

async function onClickStep(type: SetupStepType) {
    shouldUpdateOrganization = true;

    switch (type) {
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
        case SetupStepType.Registrations: {
            await GlobalEventBus.sendEvent('selectTabByName', 'leden');
            break;
        }
    }
}
</script>
