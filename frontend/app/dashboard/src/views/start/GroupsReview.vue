<template>
    <ReviewSetupStepView :type="SetupStepType.Groups" :step="step">
        <template #top>
            <p>Kijk na of alle instellingen van de groepen correct zijn. Klik op een groep om deze te bewerken.</p>
        </template>

        <p v-if="areAllGroupsClosed" class="warning-box">
            Alle groepen zijn gesloten.
        </p>

        <div v-for="category in tree.categories" :key="category.id" class="container">
            <hr>
            <h2>{{ category.settings.name }}</h2>
            <STList class="info">
                <GroupReview v-for="group in category.groups" :key="group.id" :group="group" @click="editGroup(group)" />
            </STList>
        </div>
    </ReviewSetupStepView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { EditGroupView, PromiseView, Toast, useAuth, useOrganization } from '@stamhoofd/components';
import { useOrganizationManager } from '@stamhoofd/networking';
import { Group, GroupStatus, OrganizationRegistrationPeriod, SetupStep, SetupStepType } from '@stamhoofd/structures';
import { computed } from 'vue';
import GroupReview from './GroupReview.vue';
import ReviewSetupStepView from './ReviewSetupStepView.vue';

defineProps<{step: SetupStep}>();

const auth = useAuth();
const $organization = useOrganization();
const present = usePresent();
const organizationManager = useOrganizationManager();

const period = computed(() => $organization.value!.period);

const tree = computed(() => period.value?.getCategoryTree({
    permissions: auth.permissions,
    organization: $organization.value!,
    maxDepth: 1,
    smartCombine: true
}));

const allGroups = computed(() => tree.value.getAllGroups());
const areAllGroupsClosed = computed(() => allGroups.value.every(g => g.status === GroupStatus.Closed));

async function editGroup(group: Group) {
    const displayedComponent = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(PromiseView, {
            promise: async () => {
                try {
                    // Make sure we have an up to date group
                    await organizationManager.value.forceUpdate()
                    return new ComponentWithProperties(EditGroupView, {
                        group, 
                        iswNew: false,
                        saveHandler: async (patch: AutoEncoderPatchType<Group>) => {
                            const periodPatch = OrganizationRegistrationPeriod.patch({
                                id: period.value.id
                            })
                            periodPatch.groups.addPatch(patch)
                            await organizationManager.value.patchPeriod(periodPatch)
                        }
                    })
                } catch (e) {
                    Toast.fromError(e).show()
                    throw e
                }
            }
        })
    })

    await present({
        animated: true,
        adjustHistory: true,
        modalDisplayStyle: "popup",
        components: [
            displayedComponent
        ]
    });
}
</script>
