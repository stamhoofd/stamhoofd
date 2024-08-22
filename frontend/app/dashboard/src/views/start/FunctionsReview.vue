<template>
    <ReviewSetupStepView :title="title" :type="SetupStepType.Groups">
        <h1 class="style-navigation-title">
            Kijk even na
        </h1>

        <p>Kijk na of alle instellingen van de groepen correct zijn. Klik op een groep om deze te bewerken.</p>

        <hr>
        <h2>Verplichte functies</h2>
        <STList class="info">
            <FunctionReview v-for="responsibility in requiredResponsibilities" :key="responsibility.id" :responsibility="responsibility" />
        </STList>
        <hr>
        <h2>Andere functies</h2>
        <STList class="info">
            <FunctionReview v-for="responsibility in optionalResponsibilities" :key="responsibility.id" :responsibility="responsibility" />
        </STList>
    </ReviewSetupStepView>
</template>

<script lang="ts" setup>
import { usePresent } from '@simonbackx/vue-app-navigation';
import { useAuth, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import FunctionReview from './FunctionReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

const title = 'Kijk de functies na';

const auth = useAuth();
const $organization = useOrganization();
const present = usePresent();
const organizationManager = useOrganizationManager();
const $platform = usePlatform();

const period = computed(() => $organization.value!.period);

const responsibilities = computed(() => $platform.value.config.responsibilities);
const requiredResponsibilities = computed(() => responsibilities.value.filter(r => r.minimumMembers !== null));
const optionalResponsibilities = computed(() => responsibilities.value.filter(r => r.minimumMembers === null));
</script>
