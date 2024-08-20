<template>
    <template v-if="stepsByPriority.length">
        <hr>
        <h2>Vlagmoment</h2>
        <STList :with-animation="true">
            <SetupStepRow v-for="{step, type} in stepsByPriority" :key="type" :type="type" :step="step" :save-handler="saveHandler" />
        </STList>
    </template>
</template>


<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { Toast, useContext, useOrganization } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod, SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import SetupStepRow from './SetupStepRow.vue';

const organizationManager = useOrganizationManager();
const organization$ = useOrganization();
const context = useContext();
const owner = useRequestOwner();

function getSteps() {
    return organization$.value?.period.setupSteps.getAll() ?? [];
}

const stepsByPriority = computed(() => getSteps().sort((a, b) => b.step.priority - a.step.priority));

const saveHandler = async (body: {type: SetupStepType, isReviewed: boolean}) => {
    const periodId = organization$.value?.period.id;
    if(!periodId) {
        return;
    }

    try {
        const updatedPeriod = await context.value.authenticatedServer.request({
            method: 'POST',
            path: `/organization/registration-period/${periodId}/setup-steps/review`,
            body,
            shouldRetry: false,
            owner,
            decoder: OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>,
        });

        organizationManager.value.updatePeriods([updatedPeriod.data]);
    } catch(error) {
        // todo: translate
        new Toast('Het voltooien van deze stap is mislukt.', 'error red').show();
    }
}
</script>

<style lang="scss" scoped>

</style>
