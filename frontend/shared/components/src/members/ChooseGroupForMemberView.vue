<template>
    <SearchOrganizationView v-if="!selectedOrganization" :member="member" :select-organization="addOrganization" :title="searchOrganizationTitle" />
    <div v-else class="st-view">
        <STNavigationBar :title="member.patchedMember.name" />

        <main class="center">
            <h1>{{ $t('aca992fc-1a62-41dd-a9c4-791df30e27fb', {member: member.patchedMember.firstName}) }}</h1>

            <ScrollableSegmentedControl v-if="allowChangingOrganization" v-model="selectedOrganization" :items="items" :labels="labels">
                <template #right>
                    <button :v-tooltip="$t('b0c1a91e-f776-4b10-a90f-5806d9fdd400')" class="button icon gray add" type="button" @click="searchOrganization" />
                </template>
            </ScrollableSegmentedControl>

            <p v-if="differentOrganization" class="info-box icon basket">
                {{ $t('4aeecfa0-8780-4062-86e7-962dc037e794') }} {{ selectedOrganization.name }}.
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
                <hr v-if="index > 0 || !allowChangingOrganization"><h2 class="style-with-button">
                    <div>
                        {{ category.settings.name }}
                        <span v-if="!category.settings.public" class="icon lock gray" :v-tooltip="$t('e11ad49e-d853-464c-a951-d45b9549ec30')" />
                    </div>
                    <div>
                        <span class="title-suffix">{{ selectedOrganization.period.period.nameShort }}</span>
                    </div>
                </h2>
                <STList class="illustration-list">
                    <RegisterMemberGroupRow v-for="group in category.groups" :key="group.id" :group="group" :member="member" :organization="selectedOrganization" data-testid="group-button" @click="openGroup(group)" />
                </STList>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { NavigationActions, ScrollableSegmentedControl, Toast, useAppContext, useNavigationActions, useOrganization, useUninheritedPermissions } from '@stamhoofd/components';
import { Group, GroupCategoryTree, GroupType, Organization, PlatformMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref, watch } from 'vue';
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

    return props.member.filterGroups({ organizationId, currentPeriod: true, includeFuture: false, includePending: false, types: [GroupType.WaitingList, GroupType.Membership] });
});

const alreadyRegisteredMessage = computed(() => {
    const groups = alreadyRegisteredGroups.value;

    if (groups.length > 0) {
        const firstName = props.member.patchedMember.firstName;
        const groupsString = Formatter.joinLast(groups.map(g => g.settings.name.toString()), ', ', ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ');
        return $t(`fc00001e-5d05-485c-b931-1122504e5d36`, { firstName, groups: groupsString });
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
        return $t(`2ae30b48-9f5d-4e55-9b7d-41a792704442`, { organization: organizationName ?? '', member: firstName });
    }

    return $t(`90c49f44-4daa-4746-8fda-3558c588e651`, {
        member: firstName,
        organization: organizationName ?? '',
    });
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
