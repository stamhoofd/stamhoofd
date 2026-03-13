<template>
    <template v-if="$setupSteps && !$setupSteps.isEmpty()">
        <TransitionFade>
            <p v-if="$areAllComplete && !$overrideShowSteps" key="done" class="success-box selectable with-button" @click="showSteps">
                {{ $t('%9') }}

                <button class="button text" type="button">
                    {{ $t('%Wu') }}
                </button>
            </p>
            <div v-else key="steps" class="container">
                <hr><h2>{{ $t('%A') }}</h2>
                <p>{{ $t('%C') }} <a :href="$domains.getDocs('vlagmoment')" class="inline-link" target="_blank">{{ $t('%19t') }}</a></p>
                <SetupStepRows :steps="$setupSteps" list-type="todo" @select="onClickStep" />
            </div>
        </TransitionFade>
    </template>
    <template v-else>
        <p v-if="organization$?.period.period.id !== platform.period.id" class="info-box">
            {{ $t('%B') }}
        </p>
    </template>
</template>

<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import EmailSettingsView from '@stamhoofd/components/email/EmailSettingsView.vue';
import GeneralSettingsView from '@stamhoofd/components/organizations/GeneralSettingsView.vue';
import { GlobalEventBus } from '@stamhoofd/components/EventBus.ts';
import SetupStepRows from '@stamhoofd/components/setupSteps/SetupStepRows.vue';
import TransitionFade from '@stamhoofd/components/transitions/TransitionFade.vue';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import { usePlatform } from '@stamhoofd/components/hooks/usePlatform.ts';
import { useVisibilityChange } from '@stamhoofd/components/hooks/useVisibilityChange.ts';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { SetupStepType } from '@stamhoofd/structures';
import { computed, onActivated, ref } from 'vue';
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
useVisibilityChange(() => forceUpdateOrganization(), undefined, undefined, { onFocusChange: true });

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
        component: PremisesView,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Companies,
        present: 'popup',
        component: GeneralSettingsView,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Payment,
        present: 'popup',
        component: RegistrationPaymentSettingsView,
        paramsToProps: paramToPropsFactory({ isReview: true }),
    },
    {
        url: Routes.Groups,
        present: 'popup',
        component: GroupsReview,
        paramsToProps: paramToPropsFactory(),
    },
    {
        url: Routes.Responsibilities,
        present: 'popup',
        component: FunctionsReview,
        paramsToProps: paramToPropsFactory(),
    },
    {
        url: Routes.Emails,
        present: 'popup',
        component: EmailSettingsView,
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
            await GlobalEventBus.sendEvent('selectTabById', 'members');
            break;
        }
    }
}
</script>
