<template>
    <template v-if="todo.length">
        <hr>
        <h2>Vlagmoment</h2>
        <STList>
            <SetupStepRow v-for="{step, type} in todo" :key="type" :type="type" :step="step"  @review="isReviewed => markReviewed(type, isReviewed)"/>
        </STList>
    </template>
</template>


<script setup lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { useContext, useOrganization } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { OrganizationRegistrationPeriod, SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import SetupStepRow from './SetupStepRow.vue';

const organizationManager = useOrganizationManager();
const organization$ = useOrganization();
const context = useContext();
const owner = useRequestOwner();

const todo = computed(() => organization$.value?.period.setupSteps.getAll() ?? []);

async function markReviewed(type: SetupStepType, isReviewed: boolean) {
    const periodId = organization$.value?.period.id;
    if(!periodId) {
        return;
    }

    const updatedPeriod = await context.value.authenticatedServer.request({
        method: 'POST',
        path: `/organization/registration-period/${periodId}/setup-steps/review`,
        body: {type, isReviewed},
        shouldRetry: false,
        owner,
        decoder: OrganizationRegistrationPeriod as Decoder<OrganizationRegistrationPeriod>,
    });

    organizationManager.value.updatePeriods([updatedPeriod.data]);
}
</script>

<style lang="scss" scoped>

</style>
