<template>
    <div class="st-menu st-view members-menu">
        <STNavigationBar title="Leden">
            <template #right>
                <button v-if="$canEdit" class="navigation button icon settings" type="button" @click="editMe" />
            </template>
        </STNavigationBar>

        <main>
            <h1>Leden</h1>

            <template v-if="auth.hasFullAccess()">
                <button v-if="canUpgradePeriod" type="button" class="menu-button button cta" @click="upgradePeriod">
                    <span class="icon flag" />
                    <span>Schakel over naar {{ newestPeriod.name }}</span>
                </button>
                <button v-else-if="canSetDefaultPeriod" type="button" class="menu-button button cta" @click="setDefaultPeriod">
                    <span class="icon flag" />
                    <span>{{ $t('410f13a0-286d-4f7a-b6f6-aef22327056b') }}</span>
                </button>

                <hr v-if="canUpgradePeriod || canSetDefaultPeriod">
            </template>

            <p v-if="tree.categories.length === 0" class="info-box">
                Oeps, er zijn nog geen inschrijvingsgroepen gemaakt. Ga naar de instellingen en configureer jouw inschrijvingsgroepen.
            </p>

            <div v-if="tree.categories.length > 1" class="container">
                <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                    <span class="icon ul" />
                    <span>Alle leden</span>
                </button>
            </div>
            <hr v-if="tree.categories.length > 1">

            <div v-for="(category, index) in tree.categories" :key="category.id" class="container">
                <div class="grouped">
                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Category, {properties: {category, period}}) }" @click="$navigate('category', {properties: {category, period}})">
                        <span :class="'icon ' + getCategoryIcon(category)" />
                        <span>{{ category.settings.name }}</span>
                        <span v-if="isCategoryDeactivated(category)" v-tooltip="'Deze categorie is onzichtbaar voor leden omdat activiteiten niet geactiveerd is'" class="icon error red right-icon" />
                        <span v-else-if="category.groups.length || category.categories.length" class="button icon arrow-down-small right-icon rot" :class="{rot180: collapsed.isCollapsed(category.id)}" @click.stop="collapsed.toggle(category.id)" />
                    </button>

                    <div :class="{collapsable: true, hide: collapsed.isCollapsed(category.id) || isCategoryDeactivated(category)}">
                        <button
                            v-for="c in category.categories"
                            :key="c.id"
                            class="menu-button button sub-button"
                            :class="{ selected: checkRoute(Routes.Category, {properties: {category: c, period}}) }"
                            type="button"
                            @click="$navigate(Routes.Category, {properties: {category: c, period}})"
                        >
                            <span class="icon" />
                            <span>{{ c.settings.name }}</span>
                        </button>

                        <button
                            v-for="group in category.groups"
                            :key="group.id"
                            class="menu-button button sub-button"
                            :class="{ selected: checkRoute(Routes.Group, {properties: {group, period}}) }"
                            type="button"
                            @click="$navigate(Routes.Group, {properties: {group, period}})"
                        >
                            <GroupAvatar :group="group" :allow-empty="true" />
                            <span>{{ group.settings.name }}</span>
                            <span v-if="group.settings.registeredMembers !== null" class="count">{{ formatInteger(group.settings.registeredMembers) }}</span>
                        </button>

                        <hr v-if="index < tree.categories.length - 1">
                    </div>
                </div>
            </div>

            <div v-if="auth.hasFullAccess()" class="grouped footer">
                <hr>

                <button class="menu-button button" type="button" @click="switchPeriod">
                    <span>{{ period.period.name }}</span>
                    <span class="icon gray arrow-swap right-icon" />
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, defineRoutes, NavigationController, useCheckRoute, useNavigate, usePresent, useSplitViewController, useUrl } from '@simonbackx/vue-app-navigation';
import { GroupAvatar, MembersTableView, Toast, useAuth, useContext, useOrganization, usePlatform } from '@stamhoofd/components';
import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { Group, GroupCategory, GroupCategoryTree, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { ComponentOptions, computed, onActivated } from 'vue';
import { useCollapsed } from '../../hooks/useCollapsed';
import EditCategoryGroupsView from '../dashboard/groups/EditCategoryGroupsView.vue';
import StartNewRegistrationPeriodView from './StartNewRegistrationPeriodView.vue';
import { useSwitchablePeriod } from './useSwitchablePeriod';

const $organization = useOrganization();
const $context = useContext();
const urlHelpers = useUrl();
const $navigate = useNavigate();
const collapsed = useCollapsed('leden');
const platform = usePlatform();
const organizationManager = useOrganizationManager();
const owner = useRequestOwner();
const present = usePresent();
const auth = useAuth();
const splitViewController = useSplitViewController();

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: $context.value?.organizationPermissions,
        organization: $organization.value!,
    });
});

const { period, switchPeriod } = useSwitchablePeriod({
    onSwitch: async () => {
        // Make sure we open the first group again
        if (!splitViewController.value?.shouldCollapse()) {
            await $navigate(Routes.Group, {
                properties: {
                    group: tree.value.getAllGroups()[0],
                    period: period.value,
                },
            });
        }
    },
});

const newestPeriod = computed(() => {
    return platform.value.period;
});

const canUpgradePeriod = computed(() => {
    return $organization.value?.period.period.id !== platform.value.period.id && $organization.value!.period.period.startDate < platform.value.period.startDate;
});

const canSetDefaultPeriod = computed(() => {
    return (period.value.period.id === platform.value.period.id && $organization.value!.period.period.id !== platform.value.period.id)
        || (period.value.period.startDate > $organization.value!.period.period.startDate && !period.value.period.locked);
});

const $rootCategory = computed(() => period.value.rootCategory);

const $canEdit = computed(() => organizationManager.value.user.permissions ? $rootCategory.value && $rootCategory.value.canEdit($context.value.auth.permissions) : false);

onActivated(() => {
    urlHelpers.setTitle('Leden');
});

const getCategoryIcon = (category: GroupCategoryTree) => {
    if (category.settings.name.toLocaleLowerCase().includes('lessen') || category.settings.name.toLocaleLowerCase().includes('proefles')) {
        return 'education';
    }

    if (category.settings.name.toLocaleLowerCase().includes('activiteiten') || category.settings.name.toLocaleLowerCase().includes('kamp') || category.settings.name.toLocaleLowerCase().includes('weekend')) {
        return 'flag';
    }

    if (category.settings.name.toLocaleLowerCase().includes('betaling')) {
        return 'card';
    }

    if (category.categories.length) {
        return 'category';
    }

    return 'group';
};

const isCategoryDeactivated = (category: GroupCategoryTree) => {
    return period.value.isCategoryDeactivated($organization.value!, category);
};

enum Routes {
    All = 'all',
    Category = 'category',
    Group = 'group',
    GroupWithPeriod = 'groupWithPeriod',
}

defineRoutes([
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: MembersTableView as unknown as ComponentOptions,
        paramsToProps: () => {
            return {
                periodId: period.value.period.id,
            };
        },
        propsToParams() {
            return {
                params: {
                    slug: Formatter.slug(tree.value.settings.name),
                },
            };
        },
    },
    {
        url: 'categorie/@slug',
        name: Routes.Category,
        params: {
            slug: String,
        },
        show: 'detail',
        component: async () => ((await import('../dashboard/groups/CategoryView.vue')).default) as unknown as ComponentOptions,
        paramsToProps: (params: { slug: string }) => {
            const category = tree.value.getAllCategories().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!category) {
                throw new Error('Category not found');
            }
            return {
                category,
                period: period.value,
            };
        },
        propsToParams(props) {
            if (!('category' in props)) {
                throw new Error('Missing category');
            }
            return {
                params: {
                    slug: Formatter.slug((props.category as GroupCategory).settings.name),
                },
            };
        },
    },
    {
        url: '@slug',
        name: Routes.Group,
        params: {
            slug: String,
        },
        show: 'detail',
        component: async () => ((await import('../dashboard/groups/GroupOverview.vue')).default) as unknown as ComponentOptions,
        paramsToProps: (params: { slug: string }) => {
            const group = tree.value.getAllGroups().find(g => Formatter.slug(g.settings.name) === params.slug);
            if (!group) {
                throw new Error('Group not found');
            }
            return {
                group,
                period: period.value,
            };
        },
        propsToParams(props) {
            if (!('group' in props)) {
                throw new Error('Missing group');
            }
            return {
                params: {
                    slug: Formatter.slug((props.group as Group).settings.name),
                },
            };
        },
        isDefault: tree.value.getAllGroups().length
            ? {
                    properties: {
                        group: tree.value.getAllGroups()[0],
                        period: period.value,
                    },
                }
            : undefined,
    },
]);

const checkRoute = useCheckRoute();

async function setDefaultPeriod() {
    // Patch organization period id
    try {
        await organizationManager.value.patch(
            Organization.patch({
                period: period.value,
            }),
        );
        new Toast(period.value.period.name + ' is nu ingesteld als het huidige werkjaar', 'success').show();
    }
    catch (e) {
        Toast.fromError(e).show();
    }
}

async function upgradePeriod() {
    const list = await organizationManager.value.loadPeriods(false, false, owner);
    const organizationPeriod = list.organizationPeriods.find(o => o.period.id === platform.value.period.id);

    if (organizationPeriod) {
        // We can just set the default
        period.value = organizationPeriod;
        return await setDefaultPeriod();
    }

    await present({
        components: [
            new ComponentWithProperties(StartNewRegistrationPeriodView, {
                period: platform.value.period,
                callback: () => {
                    period.value = organizationManager.value.organization.period;
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function editMe() {
    if (!$rootCategory.value) return;
    await present(new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(EditCategoryGroupsView, {
            category: $rootCategory.value,
            period: period.value,
            organization: $organization.value,
            saveHandler: async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                patch.id = period.value.id;
                await organizationManager.value.patchPeriod(patch);
            },
        }),
    }).setDisplayStyle('popup'));
}
</script>
