<template>
    <div class="st-menu-modern st-view members-menu">
        <STNavigationBar :title="$t(`%1EH`)" />

        <main>
            <h1 v-if="true" class="adjusted">
                <span>Leden</span>
            </h1>

            <div class="block">
                <div class="items">
                    <button v-if="true" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Checklist) }" @click="$navigate(Routes.Checklist)">
                        <span class="icon success small" />
                        <span>{{ $t('Stel alles op punt') }}</span>
                        <span class="right">2 / 8</span>
                    </button>

                    <button v-if="auth.hasFullAccess()" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.All) }" @click="$navigate(Routes.All)">
                        <span class="icon team small" />
                        <span>{{ $t('Alle leden') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon calendar small" />
                        <span>{{ $t('Kalender') }}</span>
                    </button>

                    <button v-if="false" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon file-pdf small" />
                        <span>{{ $t('Documenten en attesten') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Communication) }" @click="$navigate(Routes.Communication)">
                        <span class="icon email small" />
                        <span>{{ $t('Berichten') }}</span>
                    </button>

                    <button v-if="false" class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon external small" />
                        <span>{{ $t('Toon ledenportaal') }}</span>
                    </button>

                    <button class="menu-button button" type="button" :class="{ selected: checkRoute(Routes.Settings) }" @click="$navigate(Routes.Settings)">
                        <span class="icon more-in-circle small" />
                        <span>{{ $t('Meer') }}</span>
                    </button>
                </div>
            </div>

            <GroupCategoryMenuBox :period="period" />

            <div v-if="auth.hasFullAccess()" class="container footer">
                <hr>

                <button class="st-menu-item" type="button" @click="switchPeriod">
                    <span class="icon date-range" />
                    <div>
                        <h3>{{ period.period.prefix }}</h3>
                        <p>{{ period.period.nameShort }}</p>
                    </div>
                    <span class="icon right gray arrow-swap" />
                </button>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ComponentWithProperties, defineRoute, defineRoutes, SplitViewController, typeRoute, useCheckRoute, useNavigate, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, ContextMenu, ContextMenuItem, Toast } from '@stamhoofd/components';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import MembersTableView from '@stamhoofd/components/members/MembersTableView.vue';
import { useFetchOrganizationRegistrationPeriods } from '@stamhoofd/networking/hooks/useFetchOrganizationRegistrationPeriods.ts';
import type { OrganizationRegistrationPeriod, RegistrationPeriodList } from '@stamhoofd/structures/RegistrationPeriod.js';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import MembersChecklistView from '../dashboard/settings/MembersChecklistView.vue';
import MembersSettingsView from '../dashboard/settings/MembersSettingsView.vue';
import GroupCategoryMenuBox from './GroupCategoryMenuBox.vue';

const context = useContext();
const $navigate = useNavigate();
const auth = useAuth();

const hasFullAccess = computed(() => auth.hasFullAccess());

const tree = computed(() => {
    return period.value.getCategoryTree({
        permissions: context.value?.organizationPermissions,
        organization: organization.value!,
    });
});

const organization = useRequiredOrganization();
const period = computed(() => organization.value.period);
const navigationController = useNavigationController();

const showAll = computed(() => {
    return tree.value.categories.length > 1 || tree.value.getAllGroups().length > 1;
});

enum Routes {
    Checklist = 'checklist',
    Settings = 'settings',
    All = 'all',
    Category = 'category',
    Group = 'group',
    Period = 'Period',
    GroupWithPeriod = 'groupWithPeriod',
    Communication = 'berichten',
}

defineRoute({
    url: 'p/@slug',
    name: Routes.Period,
    params: {
        slug: String,
    },
    component: (props) => {
        return new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./MembersPeriodMenu.vue'), props),
        });
    },
    show: {
        getCustomShow() {
            if (!navigationController.value.navigationController) {
                console.error('Mssing navigationController parent navigation controller');
                return navigationController.value.push;
            }
            return navigationController.value.navigationController.push;
        },
    },
    paramsToProps: async (params) => {
        let periods: RegistrationPeriodList;
        try {
            periods = await fetchPeriods({ shouldRetry: false });
        } catch (e) {
            Toast.fromError(e).show();
            throw e;
        }

        const period = periods.organizationPeriods.find(p => Formatter.slug(p.period.name) === params.slug);

        if (!period) {
            throw new Error('Group not found');
        }
        return {
            period,
        };
    },
    propsToParams(props) {
        return {
            params: {
                slug: Formatter.slug(props.period.period.name),
            },
        };
    },
});

defineRoutes([
    {
        url: 'checklist',
        name: Routes.Checklist,
        show: 'detail',
        component: MembersChecklistView,
        isDefault: hasFullAccess.value
            ? { }
            : undefined,
    },

    {
        url: 'berichten',
        name: Routes.Communication,
        show: 'detail',
        component: CommunicationView,
    },

    {
        url: 'instellingen',
        name: Routes.Settings,
        show: 'detail',
        component: MembersSettingsView,
        isDefault: hasFullAccess.value
            ? { }
            : undefined,
    },
    {
        url: 'allemaal',
        name: Routes.All,
        show: 'detail',
        component: MembersTableView,
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
        isDefault: showAll.value
            ? {
                    properties: {
                        periodId: period.value.period.id,
                    },
                }
            : undefined,
    },
]);

const checkRoute = useCheckRoute();
const fetchPeriods = useFetchOrganizationRegistrationPeriods();

async function switchPeriod(event: MouseEvent) {
    let periods: RegistrationPeriodList;
    try {
        periods = await fetchPeriods({ shouldRetry: false });
    } catch (e) {
        Toast.fromError(e).show();
        return;
    }

    const menu = new ContextMenu([
        periods.organizationPeriods.map((p) => {
            return new ContextMenuItem({
                name: p.period.name,
                action: async () => {
                    await $navigate(Routes.Period, {
                        properties: {
                            period: p,
                        },
                    });
                    return true;
                },
            });
        }),
        [
            new ContextMenuItem({
                name: 'Instellingen',
                icon: 'settings',
                action: () => {
                    // todo
                    return true;
                },
            }),
        ],
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}
</script>
