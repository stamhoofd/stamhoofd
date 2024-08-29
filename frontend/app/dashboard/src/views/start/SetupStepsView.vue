<template>
    <template v-if="$stepsByPriority.length">
        <TransitionFade>
            <p v-if="$areAllComplete && !$overrideShowSteps" class="success-box selectable with-button" @click="showSteps">
                Ravot is in orde
                <button class="button text" type="button">
                    Toon stappen
                </button>
            </p>
            <div v-else class="container">
                <hr>
                <h2>Breng Ravot in orde</h2>
                <p>Overloop alle stappen en bevestig dat je alles hebt nagekeken bij elke stap. Zorg dat alles ten laatste tegen 15 oktober is nagekeken. <a :href="$domains.getDocs('vlagmoment')" class="inline-link" target="_blank">Meer info</a></p>
                <STList :with-animation="true">
                    <SetupStepRow v-for="{step, type} in $stepsByPriority" :key="type" :type="type" :step="step" />
                </STList>
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
import { TransitionFade, useOrganization, usePlatform, useVisibilityChange } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, onActivated, ref } from 'vue';
import SetupStepRow from './SetupStepRow.vue';
const organization$ = useOrganization();
const platform = usePlatform();
const organizationManager = useOrganizationManager();

const $overrideShowSteps = ref(false);
const $steps = computed(() => organization$.value?.period.setupSteps.getAll() ?? []);
const $stepsByPriority = computed(() => [...$steps.value].sort((a, b) => b.step.priority - a.step.priority));
const $areAllComplete = computed(() => $stepsByPriority.value.every(s => s.step.isComplete));

onActivated(() => forceUpdateOrganization());
useVisibilityChange(() => forceUpdateOrganization());

async function forceUpdateOrganization() {
    await organizationManager.value.forceUpdate();
}

function showSteps() {
    $overrideShowSteps.value = true;
}
</script>
