<template>
    <template v-if="$setupSteps && !$setupSteps.isEmpty()">
        <TransitionFade>
            <p v-if="$areAllComplete && !$overrideShowSteps" key="done" class="success-box selectable with-button" @click="showSteps">
                Ravot is in orde
                <button class="button text" type="button">
                    Toon stappen
                </button>
            </p>
            <div v-else key="steps" class="container">
                <hr>
                <h2>Breng Ravot in orde</h2>
                <p>Overloop alle stappen en bevestig dat je alles hebt nagekeken bij elke stap. Zorg dat alles ten laatste tegen 15 oktober is nagekeken. <a :href="$domains.getDocs('vlagmoment')" class="inline-link" target="_blank">Meer info</a></p>
                <SetupStepRows :steps="$setupSteps" list-type="todo" @select="onClickStep" />
            </div>
        </TransitionFade>
    </template>
    <template v-else>
        <p v-if="organization$?.period.period.id !== platform.period.id" class="info-box">
            Jouw groep bevindt zich in een ander werkjaar dan KSA Nationaal.
        </p>
    </template>
</template>


<script setup lang="ts">
import { defineRoutes, useNavigate } from '@simonbackx/vue-app-navigation';
import { EmailSettingsView, GeneralSettingsView, SetupStepRows, TransitionFade, useOrganization, usePlatform, useVisibilityChange } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { SetupStepType } from '@stamhoofd/structures';
import { ComponentOptions, computed, onActivated, ref } from 'vue';
import PremisesView from "../../views/dashboard/settings/PremisesView.vue";
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
            } catch (error) {
                console.error(error);
            }
        }
        shouldUpdateOrganization = false;
        return record;
    }
}

enum Routes {
    Premises = 'lokalen',
    Groups = 'leeftijdsgroepen',
    Responsibilities = 'functies',
    Companies = 'companies',
    Emails = 'emails',
    Payment = 'payment'
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

async function onClickStep(type: SetupStepType) {
    shouldUpdateOrganization = true;

    switch(type) {
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
