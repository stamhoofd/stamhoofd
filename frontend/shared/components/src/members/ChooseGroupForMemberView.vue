<template>
    <SearchOrganizationView v-if="!selectedOrganization" :member="member" :select-organization="addOrganization" :title="searchOrganizationTitle" />
    <div v-else class="st-view">
        <STNavigationBar :title="member.patchedMember.name" />

        <main class="center">
            <h1>Waarvoor wil je {{ member.patchedMember.firstName }} inschrijven?</h1>

            <ScrollableSegmentedControl v-if="allowChangingOrganization" v-model="selectedOrganization" :items="items" :labels="labels">
                <template #right>
                    <button v-tooltip="'Bij een andere vereniging inschrijven'" class="button icon gray add" type="button" @click="searchOrganization" />
                </template>
            </ScrollableSegmentedControl>

            <p v-if="differentOrganization" class="info-box icon basket">
                Reken eerst jouw huidige winkelmandje af. Je kan de huidige inhoud van jouw winkelmandje niet samen afrekenen met een inschrijving bij {{ selectedOrganization.name }}.
            </p>

            <template v-else>
                <p v-if="alreadyRegisteredMessage" class="info-box">
                    {{ alreadyRegisteredMessage }}
                </p>
                <p v-if="noGroupsMessage" class="info-box">
                    {{ noGroupsMessage }}
                </p>
            </template>

            <div v-for="(category, index) of tree.categories" :key="category.id" class="container">
                <hr v-if="index > 0 || !allowChangingOrganization">
                <h2 class="style-with-button">
                    <div>
                        {{ category.settings.name }}
                        <span v-if="!category.settings.public" v-tooltip="'Deze categorie is niet zichtbaar voor gewone leden'" class="icon lock gray" />
                    </div>
                    <div>
                        <span class="title-suffix">{{ selectedOrganization.period.period.nameShort }}</span>
                    </div>
                </h2>
                <STList class="illustration-list">
                    <RegisterMemberGroupRow v-for="group in category.groups" :key="group.id" :group="group" :member="member" :organization="selectedOrganization" @click="openGroup(group)" />
                </STList>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, ScrollableSegmentedControl, Toast, useAppContext, useNavigationActions, useOrganization, useUninheritedPermissions } from '@stamhoofd/components';
import { Group, GroupCategoryTree, GroupType, Organization, PlatformMember } from '@stamhoofd/structures';
import { computed, onMounted, Ref, ref, watch } from 'vue';

import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Formatter } from '@stamhoofd/utility';
import RegisterMemberGroupRow from './components/group/RegisterMemberGroupRow.vue';
import SearchOrganizationView from './SearchOrganizationView.vue';

const props = defineProps<{
    member: PlatformMember;
    selectionHandler: (data: { group: Group; groupOrganization: Organization }, navigate: NavigationActions) => Promise<void> | void;
}>();

const selectedOrganization = ref((props.member.organizations[0] ?? null) as any) as Ref<Organization | null>;
const auth = useUninheritedPermissions({ patchedOrganization: selectedOrganization });
const present = usePresent();
const app = useAppContext();
const $t = useTranslate();
const searchOrganizationTitle = computed(() => $t('2669729c-718d-49a1-9e4f-b3a65a6479a8', { firstName: props.member.patchedMember.firstName }));
const navigate = useNavigationActions();
const organization = useOrganization();
const differentOrganization = computed(() => selectedOrganization.value && !props.member.family.checkout.cart.isEmpty && props.member.family.checkout.singleOrganization?.id !== selectedOrganization.value.id);

watch(selectedOrganization, () => {
    checkOrganization();
});

function checkOrganization() {
    if (app !== 'registration') {
        if (!organization.value) {
            // Administration panel: register as organizing organization
            props.member.family.checkout.asOrganizationId = selectedOrganization.value?.id ?? null;
        }
        else {
            props.member.family.checkout.asOrganizationId = organization.value.id;
        }
        props.member.family.checkout.defaultOrganization = selectedOrganization.value;
    }
}

onMounted(() => {
    checkOrganization();
});

const items = computed(() => {
    return props.member.organizations;
});
const labels = computed(() => {
    return items.value.map(o => o.name);
});
const allowChangingOrganization = STAMHOOFD.userMode === 'platform' && (app === 'registration' || app === 'admin') && !STAMHOOFD.singleOrganization;

const tree = computed(() => treeFactory({
    filterGroups: (g) => {
        return props.member.family.checkout.isAdminFromSameOrganization || props.member.canRegister(g, selectedOrganization.value!) || props.member.canRegisterForWaitingList(g, selectedOrganization.value!);
    },
}));

const alreadyRegisteredGroups = computed(() => {
    const organizationId = selectedOrganization.value?.id;

    if (!organizationId) {
        return [];
    }

    return props.member.filterGroups({ organizationId, currentPeriod: true, includePending: false, types: [GroupType.WaitingList, GroupType.Membership] });
});

const alreadyRegisteredMessage = computed(() => {
    const groups = alreadyRegisteredGroups.value;

    if (groups.length > 0) {
        const firstName = props.member.patchedMember.firstName;
        const groupsString = Formatter.joinLast(groups.map(g => g.settings.name), ', ', ' en ');
        return `${firstName} is reeds ingeschreven bij ${groupsString}.`;
    }

    return null;
});

function treeFactory({ filterGroups }: { filterGroups?: ((group: Group) => boolean) | undefined }) {
    if (!selectedOrganization.value) {
        return GroupCategoryTree.create({});
    }
    return selectedOrganization.value.getCategoryTree({
        maxDepth: 1,
        admin: !!auth.permissions,
        smartCombine: true, // don't concat group names with multiple levels if all categories only contain one group
        filterGroups,
    });
}

const noGroupsMessage = computed(() => {
    if (tree.value.categories.length > 0) {
        return null;
    }

    const groups = alreadyRegisteredGroups.value;

    const firstName = props.member.patchedMember.firstName;
    const organizationName = selectedOrganization.value?.name;

    if (groups.length > 0) {
        return `Er zijn geen andere groepen bij ${organizationName} waarvoor ${firstName} kan inschrijven. Dit kan het geval zijn als: de inschrijvingen gesloten zijn of als dit lid in geen enkele andere groep 'past' (bv. leeftijd).`;
    }

    return `${firstName} kan je op dit moment niet inschrijven bij ${organizationName}. Dit kan het geval zijn als: de inschrijvingen gesloten zijn of als dit lid in geen enkele groep 'past' (bv. leeftijd).`;
});

function addOrganization(organization: Organization) {
    props.member.insertOrganization(organization);
    selectedOrganization.value = organization;
}

async function openGroup(group: Group) {
    try {
        await props.selectionHandler({ group, groupOrganization: selectedOrganization.value! }, navigate);
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function searchOrganization() {
    await present({
        url: 'zoeken',
        components: [
            new ComponentWithProperties(SearchOrganizationView, {
                title: searchOrganizationTitle.value,
                selectOrganization: async (organization: Organization, { pop }: NavigationActions) => {
                    addOrganization(organization);
                    await pop({ force: true });
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>
