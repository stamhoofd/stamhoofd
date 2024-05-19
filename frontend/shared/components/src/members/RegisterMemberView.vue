<template>
    <SearchMemberOrganizationView v-if="!selectedOrganization" :member="member" :select-organization="addOrganization" />
    <div v-else class="st-view">
        <STNavigationBar :title="member.patchedMember.name" />

        <main class="center">
            <h1>Waarvoor wil je {{ member.patchedMember.firstName }} inschrijven?</h1>

            <ScrollableSegmentedControl v-if="allowChangingOrganization" v-model="selectedOrganization" :items="items" :labels="labels">
                <template #right>
                    <button v-tooltip="'Bij een andere vereniging inschrijven'" class="button icon gray add" type="button" @click="searchOrganization" />
                </template>
            </ScrollableSegmentedControl>

            <p v-if="tree.categories.length == 0" class="error-box">
                {{ member.patchedMember.firstName }} kan je op dit moment niet meer inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn, als dit lid in geen enkele groep 'past' (bv. leeftijd) of als dit lid al is ingeschreven.
            </p>

            <div v-for="(category, index) of tree.categories" :key="category.id" class="container">
                <hr v-if="index > 0 || !allowChangingOrganization">
                <h2>
                    {{ category.settings.name }}
                    <span v-if="!category.settings.public" v-tooltip="'Deze categorie is niet zichtbaar voor gewone leden'" class="icon lock" />
                </h2>
                <STList class="illustration-list">
                    <RegisterMemberGroupRow v-for="group in category.groups" :key="group.id" :group="group" :member="member" />
                </STList>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, PopOptions, usePresent } from '@simonbackx/vue-app-navigation';
import { ScrollableSegmentedControl, useUninheritedPermissions } from '@stamhoofd/components';
import { GroupCategoryTree, Organization, PlatformMember } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';

import RegisterMemberGroupRow from './components/group/RegisterMemberGroupRow.vue';
import SearchMemberOrganizationView from './SearchMemberOrganizationView.vue';

const props = defineProps<{
    member: PlatformMember;
}>();

const selectedOrganization = ref((props.member.organizations[0] ?? null) as any) as Ref<Organization|null>;
const auth = useUninheritedPermissions({patchedOrganization: selectedOrganization})
const present = usePresent()

const items = computed(() => {
    return props.member.organizations
});
const labels = computed(() => {
    return items.value.map(o => o.name)
});
const allowChangingOrganization = STAMHOOFD.userMode === 'platform'

const tree = computed(() => {
    if (!selectedOrganization.value) {
        return  GroupCategoryTree.create({})
    }
    return selectedOrganization.value.getCategoryTree({
        maxDepth: 1, 
        admin: !!auth.permissions, 
        smartCombine: true, // don't concat group names with multiple levels if all categories only contain one group
        filterGroups: (g) => {
            return props.member.canRegister(g);
        }
    })
});

function addOrganization(organization: Organization) {
    props.member.insertOrganization(organization);
    selectedOrganization.value = organization;
}

async function searchOrganization() {
    await present({
        url: 'zoeken',
        components: [
            new ComponentWithProperties(SearchMemberOrganizationView, {
                member: props.member,
                selectOrganization: async (organization: Organization, pop: (options?: PopOptions) => Promise<void>) => {
                    addOrganization(organization)
                    await pop({force: true});
                }
            })
        ],
        modalDisplayStyle: "popup"
    })
}

</script>
