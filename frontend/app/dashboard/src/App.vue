<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ModalStackComponent, NavigationController, setTitleSuffix, SplitViewController, ComponentWithPropertiesInstance, onCheckRoutes } from '@simonbackx/vue-app-navigation';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AuditLogsView from '@stamhoofd/components/audit-logs/AuditLogsView.vue';
import ManageEventsView from '@stamhoofd/components/events/ManageEventsView.vue';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import NoPermissionsView from '@stamhoofd/components/auth/NoPermissionsView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem, TabBarItemGroup } from '@stamhoofd/components/containers/TabBarItem.ts';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { computed, ref } from 'vue';

import { WhatsNewCount } from './classes/WhatsNewCount';
import { AccessRight, PermissionLevel, PermissionsResourceType } from '@stamhoofd/structures';
import { usePlatformManager } from '@stamhoofd/networking';
import { AuthenticatedView, useContext, getLoginRoot } from '@stamhoofd/components';

const context = useContext();
const platformManager = usePlatformManager();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    noPermissionsRoot: wrapWithModalStack(getNoPermissionsView()),
    loginRoot: wrapWithModalStack(getLoginRoot()),
    root: wrapWithModalStack(getRoot()),
});
root.setCheckRoutes(); // DISCLAIMER waiting for upstream fix

function getNoPermissionsView() {
    return new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: $t(`%GV`),
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    });
}

function getRoot() {
    const organization = context.value.organization;
    if (!organization) {
        throw new Error('Organization should be provided in dashboard route');
    }

    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "StartView", webpackPrefetch: true */ './views/start/StartView.vue'), {}),
    });

    setTitleSuffix(organization.name);

    const startTab = new TabBarItem({
        id: 'start',
        icon: 'home',
        name: $t(`%I`),
        component: startView,
    });

    const membersTab = new TabBarItem({
        id: 'members',
        icon: 'group',
        name: $t(`%1EH`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/members/MembersMenu.vue'), {}),
        }),
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const webshopsTab = new TabBarItem({
        id: 'webshops',
        icon: 'basket',
        name: $t(`%2V`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/webshops/WebshopsMenu.vue'), {}),
        }),
    });

    const whatsNewBadge = ref('');

    const loadWhatsNew = () => {
        const currentCount = localStorage.getItem('what-is-new');
        if (currentCount) {
            const c = parseInt(currentCount);
            if (!isNaN(c) && WhatsNewCount - c > 0) {
                whatsNewBadge.value = (WhatsNewCount - c).toString();
            }
        } else {
            localStorage.setItem('what-is-new', WhatsNewCount.toString());
        }
    };
    loadWhatsNew();

    const settingsTab = new TabBarItem({
        id: 'settings',
        icon: 'settings',
        name: $t(`%xU`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/SettingsView.vue'), {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`%tx`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/FinancesView.vue'), {}),
        }),
    });

    const documentsTab = new TabBarItem({
        id: 'documents',
        icon: 'file-filled',
        name: $t(`%tw`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/documents/DocumentTemplatesView.vue'), {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        id: 'audit-logs',
        icon: 'history',
        name: $t(`%GY`),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(CommunicationView, {}),
        }),
    });

    const sharedMoreItems: TabBarItem[] = [];

    if (STAMHOOFD.CHANGELOG_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                id: 'whats-new',
                icon: 'gift',
                name: $t(`%xV`),
                badge: whatsNewBadge,
                action: async function () {
                    window.open(STAMHOOFD.CHANGELOG_URL![STAMHOOFD.fixedCountry ?? organization.address?.country ?? ''] ?? STAMHOOFD.CHANGELOG_URL![''], '_blank');
                    whatsNewBadge.value = '';
                    localStorage.setItem('what-is-new', WhatsNewCount.toString());
                },
            }),
        );
    }

    if (STAMHOOFD.domains.documentation) {
        sharedMoreItems.push(
            new TabBarItem({
                id: 'documentation',
                icon: 'book',
                name: $t(`%xW`),
                action: async function () {
                    window.open('https://' + LocalizedDomains.documentation, '_blank');
                },
            }),
        );
    }

    if (STAMHOOFD.NOLT_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                id: 'feedback',
                icon: 'feedback',
                name: $t(`%18`),
                action: async function () {
                    const NoltHelper = (await import('./classes/NoltHelper'));
                    await NoltHelper.openNolt(context.value, false);
                },
            }),
        );
    } else if (STAMHOOFD.FEEDBACK_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                id: 'feedback',
                icon: 'feedback',
                name: $t(`%18`),
                action: async function () {
                    window.open(STAMHOOFD.FEEDBACK_URL!, '_blank');
                },
            }),
        );
    }
    return new ComponentWithProperties(TabBarController, {
        tabs: computed(() => {
            const tabs: (TabBarItem | TabBarItemGroup)[] = [
                startTab,
            ];

            if (organization.meta.packages.useMembers || STAMHOOFD.environment === 'development') {
                tabs.push(membersTab);
            }

            if (platformManager.value.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', context.value)) {
                tabs.push(calendarTab);
            }

            if (organization.meta.packages.useWebshops && STAMHOOFD.domains.webshop) {
                if (context.value.auth.hasAccessRight(AccessRight.OrganizationCreateWebshops) || !!organization.webshops.find(w => context.value.auth.canAccessWebshop(w, PermissionLevel.Read))) {
                    tabs.push(webshopsTab);
                }
            }

            const moreTab = new TabBarItemGroup({
                icon: 'category',
                name: $t(`%GZ`),
                items: [
                    ...sharedMoreItems, // need to create a new array, don't pass directly!
                ],
            });

            if (context.value.auth.hasFullAccess()) {
                moreTab.items.unshift(auditLogsTab);
                moreTab.items.unshift(documentsTab);
                moreTab.items.unshift(financesTab);
                moreTab.items.unshift(communicationTab);
                moreTab.items.unshift(settingsTab);
            } else {
                if (context.value.auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                    moreTab.items.unshift(financesTab);
                }

                if (context.value.auth.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders)
                    || context.value.auth.hasAccessRightForSomeResourceOfType(PermissionsResourceType.Senders, AccessRight.SendMessages)) {
                    moreTab.items.unshift(communicationTab);
                }
            }

            if (moreTab.items.length > 0) {
                tabs.push(moreTab);
            }

            return tabs;
        }),
    });
}
</script>
