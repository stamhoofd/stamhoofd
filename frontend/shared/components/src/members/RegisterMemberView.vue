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
                    <RegisterMemberGroupRow v-for="group in category.groups" :key="group.id" :group="group" :member="member" @click="openGroup(group)"/>
                </STList>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, PopOptions, usePresent, useShow } from '@simonbackx/vue-app-navigation';
import { NavigationActions, ScrollableSegmentedControl, Toast, useAppContext, usePlatformFamilyManager, useUninheritedPermissions } from '@stamhoofd/components';
import { Group, GroupCategoryTree, Organization, PlatformMember, RegisterCart, RegisterItem, Registration } from '@stamhoofd/structures';
import { computed, markRaw, Ref, ref } from 'vue';

import RegisterMemberGroupRow from './components/group/RegisterMemberGroupRow.vue';
import GroupView from './GroupView.vue';
import SearchMemberOrganizationView from './SearchMemberOrganizationView.vue';
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import ConfigureNewRegistrationsView from './ConfigureNewRegistrationsView.vue';
import MemberStepView from './MemberStepView.vue';
import EditMemberAllBox from './components/edit/EditMemberAllBox.vue';

const props = defineProps<{
    member: PlatformMember;
}>();

const selectedOrganization = ref((props.member.organizations[0] ?? null) as any) as Ref<Organization|null>;
const auth = useUninheritedPermissions({patchedOrganization: selectedOrganization})
const present = usePresent()
const show = useShow()
const app = useAppContext();
const manager = usePlatformFamilyManager();

const items = computed(() => {
    return props.member.organizations
});
const labels = computed(() => {
    return items.value.map(o => o.name)
});
const allowChangingOrganization = STAMHOOFD.userMode === 'platform' && (app === 'registration' || app == 'admin');

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

async function registerAsAdmin(group: Group) {
    const cart = new RegisterCart()
    const cartItem = RegisterItem.defaultFor(props.member, group)
    cart.add(cartItem)
    cart.calculatePrices()

    // Create a registration
    const registration = Registration.create({
        groupId: group.id,
        organizationId: group.organizationId,
        registeredAt: new Date(),
        waitingList: cartItem.waitingList,
        price: cartItem.calculatedPrice,
        pricePaid: 0,
        cycle: group.cycle
    })

    const arr = new PatchableArray() as PatchableArrayAutoEncoder<Registration>
    arr.addPut(registration)

    // Create a clone
    // (prevents adding the same registration twice)
    const cloned = props.member.clone()
    cloned.addPatch({
        registrations: arr
    })

    // Show registration editor
    await show({
        components: [
            new ComponentWithProperties(ConfigureNewRegistrationsView, {
                members: [cloned],
                saveHandler: async (navigate: NavigationActions) => {
                    await manager.save(cloned.family.members)
                    await navigate.dismiss({force: true})
                    Toast.success(cloned.patchedMember.firstName + " is ingeschreven").show()

                    // Copy over all the changes to the original member
                    props.member.family.copyFromClone(cloned.family)

                    await navigate.present({
                        components: [
                            new ComponentWithProperties(MemberStepView, {
                                member: props.member,
                                title: 'Gegevens aanvullen',
                                component: markRaw(EditMemberAllBox)
                            })
                        ],
                        modalDisplayStyle: "popup"
                    })
                }
            })
        ]
    })
}

async function openGroup(group: Group) {
    if (app !== 'registration') {
        return await registerAsAdmin(group)
    }
    await show({
        components: [
            new ComponentWithProperties(GroupView, {
                member: props.member,
                group
            })
        ]
    })
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
