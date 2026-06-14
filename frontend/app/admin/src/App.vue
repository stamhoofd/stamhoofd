<template>
    <ComponentWithPropertiesInstance :component="root" />
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent, NavigationController, setTitleSuffix, SplitViewController, useCurrentComponent } from '@simonbackx/vue-app-navigation';

import { useLoginRoot } from '@stamhoofd/components/auth/useLoginRoot.ts';

import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import AuthenticatedView from '@stamhoofd/components/containers/AuthenticatedView.vue';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem, TabBarItemGroup } from '@stamhoofd/components/containers/TabBarItem.ts';

import { useContext } from '@stamhoofd/components/hooks/useContext';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { usePlatformManager } from '@stamhoofd/networking/PlatformManager';
import { AccessRight, PermissionsResourceType } from '@stamhoofd/structures';
import { computed } from 'vue';

import { useAdminAuditLogRenderers } from './views/organizations/useAdminAuditLogRenderers';

const getLoginRoot = useLoginRoot();
const context = useContext();
const platformManager = usePlatformManager();
const auditLogRenderers = useAdminAuditLogRenderers();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    noPermissionsRoot: wrapWithModalStack(getNoPermissionsView()),
    root: wrapWithModalStack(getRoot()),
    loginRoot: wrapWithModalStack(getLoginRoot()),
});
const component = useCurrentComponent();
if (component?.checkRoutes) {
    root.setCheckRoutes();
}

function getNoPermissionsView() {
    return new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: $t(`%GV`),
                component: new ComponentWithProperties(NavigationController, {
                    root: AsyncComponent(() => import('@stamhoofd/components/auth/NoPermissionsView.vue'), {}),
                }),
            }),
        ],
    });
}

function getRoot() {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {}),
    });

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {}),
    });

    const membersTableView = new ComponentWithProperties(SplitViewController, {
        root: AsyncComponent(() => import('./views/members/MembersMenu.vue'), {}),
    });

    const organizationsTableView = new ComponentWithProperties(SplitViewController, {
        root: AsyncComponent(() => import('./views/organizations/OrganizationsMenu.vue'), {}),
    });

    setTitleSuffix($t(`%GW`));

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
        component: membersTableView,
    });

    const groupsTab = new TabBarItem({
        id: 'organizations',
        icon: 'location',
        name: $t('%83'),
        component: organizationsTableView,
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`%uB`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('@stamhoofd/components/events/ManageEventsView.vue'), {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`%GX`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./views/finances/ChargeMembershipsView.vue'), {}),
        }),
    });

    const eventNotificationsTab = new TabBarItem({
        id: 'event-notifications',
        icon: 'notification',
        name: $t(`%CV`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('./views/event-notifications/EventNotificationsTableView.vue'), {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        id: 'audit-logs',
        icon: 'history',
        name: $t(`%GY`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('@stamhoofd/components/audit-logs/AuditLogsView.vue'), {
                customRenderers: auditLogRenderers,
            }),
        }),
    });

    const webshopsTab = new TabBarItem({
        id: 'webshops',
        icon: 'basket',
        name: $t('%1Pd'),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/webshops/WebshopsTableView.vue'), {}),
        }),
    });

    const settingsTab = new TabBarItem({
        id: 'settings',
        icon: 'settings',
        name: $t(`%xU`),
        component: settingsView,
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`%1DK`),
        component: new ComponentWithProperties(NavigationController, {
            root: AsyncComponent(() => import('@stamhoofd/components/communication/CommunicationView.vue'), {}),
        }),
    });

    return new ComponentWithProperties(TabBarController, {
        tabs: computed(() => {
            const isPlatform = STAMHOOFD.userMode === 'platform';

            const tabs: (TabBarItem | TabBarItemGroup)[] = [
                startTab,
                membersTab,
            ];

            if (!STAMHOOFD.singleOrganization) {
                tabs.push(groupsTab);
            }

            if (isPlatform) {
                if (platformManager.value.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', context.value)) {
                    tabs.push(calendarTab);
                }
            }

            const moreTab = new TabBarItemGroup({
                icon: 'category',
                name: $t(`%GZ`),
                items: [],
            });

            if (context.value.auth.hasFullAccess()) {
                moreTab.items.push(settingsTab);
                moreTab.items.push(communicationTab);
                moreTab.items.push(financesTab);
                moreTab.items.push(webshopsTab);
                moreTab.items.push(auditLogsTab);
            } else {
                if (context.value.auth.canReadEmails()) {
                    moreTab.items.push(communicationTab);
                }
            }

            if (manualFeatureFlag('event-notifications', context.value) && context.value.auth.hasAccessRightForSomeResourceOfType(PermissionsResourceType.OrganizationTags, AccessRight.OrganizationEventNotificationReviewer)) {
                // Feature is still in development so not visible for everyone
                moreTab.items.push(eventNotificationsTab);
            }

            if (moreTab.items.length > 0) {
                tabs.push(moreTab);
            }

            return tabs;
        }),
    });
}
</script>
