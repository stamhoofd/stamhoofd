<template>
    <SearchOrganizationView v-if="!selectedOrganization" :member="member" :select-organization="addOrganization" :title="searchOrganizationTitle" />
    <div v-else class="st-view">
        <STNavigationBar :title="member.patchedMember.name" />

        <main class="center">
            <h1>{{ $t('%di', {member: member.patchedMember.firstName}) }}</h1>

            <ScrollableSegmentedControl v-if="showControl" v-model="selectedControlTab" :items="controlItems" :labels="controlLabels" data-testid="register-tabs">
                <template #right>
                    <button v-if="allowChangingOrganization" v-tooltip="$t('%dj')" class="button icon gray add" type="button" @click="searchOrganization" />
                </template>
            </ScrollableSegmentedControl>

            <RegisterMemberEventsBox v-if="isEventsActive" :member="member" :organization="selectedOrganization" @select="openEvent" />

            <template v-else>
                <p v-if="differentOrganization" class="info-box icon basket">
                    {{ $t('%dk') }} {{ selectedOrganization.name }}.
                </p>

                <template v-else>
                    <p v-if="alreadyRegisteredMessage" class="info-box">
                        {{ alreadyRegisteredMessage }}
                    </p>
                    <p v-if="noGroupsMessage" class="info-box">
                        {{ noGroupsMessage }}
                    </p>
                </template>

                <div v-if="showGroupSearch" class="input-with-buttons">
                    <div>
                        <form class="input-icon-container icon search small gray" @submit.prevent="blurFocus">
                            <input v-model="groupSearchQuery" v-autofocus="true" class="input" name="search" type="search" inputmode="search" enterkeyhint="search" autocorrect="off" autocomplete="off" :spellcheck="false" autocapitalize="off" data-testid="group-search-input" :placeholder="$t('%ZdO')">
                        </form>
                    </div>
                </div>

                <div v-for="({ category, groups }, index) of filteredCategories" :key="category.id" class="container">
                    <hr v-if="index > 0 || !showControl || showGroupSearch"><h2 class="style-with-button">
                        <div>
                            {{ category.settings.name }}
                            <span v-if="!category.settings.public" class="icon lock gray" :v-tooltip="$t('%dl')" />
                        </div>
                        <div>
                            <span class="title-suffix">{{ selectedOrganization.period.period.nameShort }}</span>
                        </div>
                    </h2>
                    <STList class="illustration-list">
                        <RegisterMemberGroupRow v-for="group in groups" :key="group.id" :group="group" :member="member" :organization="selectedOrganization" data-testid="group-button" @click="openGroup(group)" />
                    </STList>
                </div>

                <p v-if="showGroupSearch && groupSearchQuery && filteredCategories.length === 0" class="info-box">
                    {{ $t('%ZdY') }}
                </p>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useAppContext } from '#context/appContext.ts';
import { useEventsEnabled } from '#hooks/useEventsEnabled.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { useUninheritedPermissions } from '#hooks/useUninheritedPermissions.ts';
import ScrollableSegmentedControl from '#inputs/ScrollableSegmentedControl.vue';
import { Toast } from '#overlays/Toast.ts';
import type { NavigationActions } from '#types/NavigationActions.ts';
import { useNavigationActions } from '#types/NavigationActions.ts';
import { usePresent } from '@simonbackx/vue-app-navigation';
import type { Event, Group, Organization, PlatformMember } from '@stamhoofd/structures';
import { GroupCategoryTree, GroupType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, onMounted, ref, watch } from 'vue';
import RegisterMemberEventsBox from './components/group/RegisterMemberEventsBox.vue';
import RegisterMemberGroupRow from './components/group/RegisterMemberGroupRow.vue';
import SearchOrganizationView from './SearchOrganizationView.vue';

const props = defineProps<{
    member: PlatformMember;
    selectionHandler: (data: { group: Group; groupOrganization?: Organization }, navigate: NavigationActions) => Promise<void> | void;
    defaultOrganization?: Organization;
}>();

const selectedOrganization = ref((props.member.organizations[0] ?? null) as any) as Ref<Organization | null>;
const auth = useUninheritedPermissions({ patchedOrganization: selectedOrganization });
const present = usePresent();
const app = useAppContext();

const searchOrganizationTitle = computed(() => $t('%5G', { firstName: props.member.patchedMember.firstName }));
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
        } else {
            props.member.family.checkout.asOrganizationId = organization.value.id;
        }
        props.member.family.checkout.defaultOrganization = selectedOrganization.value;
    }
}

onMounted(() => {
    checkOrganization();
});

const allowChangingOrganization = STAMHOOFD.userMode === 'platform' && (app === 'registration' || app === 'admin') && !STAMHOOFD.singleOrganization;

// A single segmented control combines organization switching (when allowed) and, when the events feature
// is enabled, an extra 'Activiteiten' tab to register the member for an event. Never show two controls at once.
const GROUPS_TAB = 'groups';
const EVENTS_TAB = 'events';
const eventsEnabled = useEventsEnabled();
const isEventsTab = ref(false);
const isEventsActive = computed(() => isEventsTab.value && eventsEnabled.value);

// The control is shown when there is something to switch between: organizations and/or the events tab
const showControl = computed(() => allowChangingOrganization || eventsEnabled.value);

// Items are organization ids (when switching is allowed) or a single 'groups' tab, plus the 'events' tab when enabled
const controlItems = computed(() => {
    const list = allowChangingOrganization ? props.member.organizations.map(o => o.id) : [GROUPS_TAB];
    if (eventsEnabled.value) {
        list.push(EVENTS_TAB);
    }
    return list;
});

const controlLabels = computed(() => controlItems.value.map((id) => {
    if (id === EVENTS_TAB) {
        return $t('%uB');
    }
    if (id === GROUPS_TAB) {
        return tree.value?.categories.length === 1 && selectedOrganization.value ? tree.value?.categories[0].getName(selectedOrganization.value.period) : $t('%wP');
    }
    return props.member.organizations.find(o => o.id === id)?.name ?? '';
}));

const selectedControlTab = computed<string>({
    get() {
        if (isEventsActive.value) {
            return EVENTS_TAB;
        }
        if (!allowChangingOrganization) {
            return GROUPS_TAB;
        }
        return selectedOrganization.value?.id ?? GROUPS_TAB;
    },
    set(value: string) {
        if (value === EVENTS_TAB) {
            isEventsTab.value = true;
            return;
        }
        isEventsTab.value = false;
        if (value !== GROUPS_TAB) {
            const organization = props.member.organizations.find(o => o.id === value);
            if (organization) {
                selectedOrganization.value = organization;
            }
        }
    },
});

const tree = computed(() => treeFactory({
    filterGroups: (g) => {
        return props.member.family.checkout.isAdminFromSameOrganization || props.member.canRegister(g, selectedOrganization.value!) || props.member.canRegisterForWaitingList(g, selectedOrganization.value!);
    },
}));

// Search within the listed groups, only offered when the list gets long
const groupSearchQuery = ref('');
const totalGroupCount = computed(() => tree.value.categories.reduce((sum, category) => sum + category.groups.length, 0));
const showGroupSearch = computed(() => totalGroupCount.value > 5);

const filteredCategories = computed(() => {
    // Ignore the query when the search field is hidden (e.g. after switching to an organization with few groups)
    const query = showGroupSearch.value ? Formatter.slug(groupSearchQuery.value.trim()) : '';

    return tree.value.categories
        .map((category) => {
            const groups = query.length === 0
                ? category.groups
                : category.groups.filter(g => Formatter.slug(g.settings.name.toString()).includes(query));
            return { category, groups };
        })
        .filter(entry => entry.groups.length > 0);
});

const alreadyRegisteredGroups = computed(() => {
    const organizationId = selectedOrganization.value?.id;

    if (!organizationId) {
        return [];
    }

    return props.member.filterGroups({ organizationId, currentPeriod: true, includeFuture: false, includePending: false, types: [GroupType.WaitingList, GroupType.Membership] });
});

const alreadyRegisteredMessage = computed(() => {
    if (props.member.family.checkout.isAdminFromSameOrganization) {
        return null;
    }

    const groups = alreadyRegisteredGroups.value;

    if (groups.length > 0) {
        const firstName = props.member.patchedMember.firstName;
        const groupsString = Formatter.joinLast(groups.map(g => g.settings.name.toString()), ', ', ' ' + $t(`%M1`) + ' ');
        return $t(`%15W`, { firstName, groups: groupsString });
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
        return $t(`%zL`, { organization: organizationName ?? '', member: firstName });
    }

    return $t(`%14G`, {
        member: firstName,
        organization: organizationName ?? '',
    });
});

function addOrganization(organization: Organization) {
    props.member.insertOrganization(organization);
    selectedOrganization.value = organization;
    // Selecting an organization always shows its groups, not the events tab
    isEventsTab.value = false;
}

if (props.defaultOrganization) {
    addOrganization(props.defaultOrganization);
}

async function openGroup(group: Group) {
    try {
        await props.selectionHandler({ group, groupOrganization: selectedOrganization.value! }, navigate);
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function openEvent(event: Event) {
    if (!event.group) {
        return;
    }
    try {
        await props.selectionHandler({ group: event.group, groupOrganization: props.member.family.getOrganization(event.group.organizationId) }, navigate);
    } catch (e) {
        Toast.fromError(e).show();
    }
}

function blurFocus() {
    (document.activeElement as HTMLElement)?.blur();
}

async function searchOrganization() {
    await present({
        url: 'zoeken',
        components: [
            AsyncComponent(() => import('./SearchOrganizationView.vue'), {
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
