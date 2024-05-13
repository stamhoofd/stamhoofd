<template>
    <SearchMemberOrganizationView v-if="!selectedOrganization" :member="member" />
    <div v-else class="st-view">
        <STNavigationBar :title="member.patchedMember.name" />

        <main class="center">
            <h1>Waarvoor wil je {{ member.patchedMember.firstName }} inschrijven?</h1>

            <p v-if="tree.categories.length == 0" class="error-box">
                {{ member.patchedMember.firstName }} kan je op dit moment niet meer inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn, als dit lid in geen enkele groep 'past' (bv. leeftijd) of als dit lid al is ingeschreven.
            </p>

            <div v-for="category of tree.categories" :key="category.id" class="container">
                <hr>
                <h2>
                    {{ category.settings.name }}
                    <span v-if="!category.settings.public" v-tooltip="'Deze categorie is niet zichtbaar voor gewone leden'" class="icon lock" />
                </h2>
                <STList class="illustration-list">
                    <RegisterMemberGroupRow v-for="group in category.groups" :key="group.id" :group="group" :member="member" />
                </STList>
            </div>

            <!--<hr v-if="hasMore">
            <button v-if="hasMore" class="button text" type="button" @click="showAll">
                <span class="icon ul" />
                <span>Toon alles</span>
            </button>-->
        </main>
    </div>
</template>

<script setup lang="ts">
import { useUninheritedPermissions } from '@stamhoofd/components';
import { GroupCategoryTree, Organization, PlatformMember } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';

import { useMemberManager } from '../../getRootView';
import RegisterMemberGroupRow from './components/RegisterMemberGroupRow.vue';
import SearchMemberOrganizationView from './SearchMemberOrganizationView.vue';

const props = defineProps<{
    member: PlatformMember;
}>();

const selectedOrganization = ref(props.member.organizations[0] ?? null) as Ref<Organization|null>;
const auth = useUninheritedPermissions({patchedOrganization: selectedOrganization})
const memberManager  = useMemberManager();

const tree = computed(() => {
    if (!selectedOrganization.value) {
        return  GroupCategoryTree.create({})
    }
    return selectedOrganization.value.getCategoryTree({
        maxDepth: 1, 
        admin: !!auth.permissions, 
        smartCombine: true, // don't concat group names with multiple levels if all categories only contain one group
        filterGroups: (g) => {
            return memberManager.canRegister(props.member, g);
        }
    })
});

</script>
