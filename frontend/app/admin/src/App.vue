<template>
    <div data-testid="app-root-admin" style="display: contents">
        <ComponentWithPropertiesInstance :component="root" />
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, ComponentWithPropertiesInstance, ModalStackComponent, NavigationController, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { getLoginRoot, AuthenticatedView, useContext } from '@stamhoofd/components';
import AuditLogsView from '@stamhoofd/components/audit-logs/AuditLogsView.vue';
import NoPermissionsView from '@stamhoofd/components/auth/NoPermissionsView.vue';
import CommunicationView from '@stamhoofd/components/communication/CommunicationView.vue';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';
import TabBarController from '@stamhoofd/components/containers/TabBarController.vue';
import { TabBarItem, TabBarItemGroup } from '@stamhoofd/components/containers/TabBarItem.ts';
import ManageEventsView from '@stamhoofd/components/events/ManageEventsView.vue';
import { manualFeatureFlag } from '@stamhoofd/components/hooks/useFeatureFlag.ts';
import { usePlatformManager } from '@stamhoofd/networking';
import { AccessRight, PermissionsResourceType } from '@stamhoofd/structures';
import { computed } from 'vue';
import EventNotificationsTableView from './views/event-notifications/EventNotificationsTableView.vue';
import ChargeMembershipsView from './views/finances/ChargeMembershipsView.vue';
import MembersMenu from './views/members/MembersMenu.vue';
import OrganizationsMenu from './views/organizations/OrganizationsMenu.vue';
import WebshopsTableView from './views/webshops/WebshopsTableView.vue';

const context = useContext();
const platformManager = usePlatformManager();

function wrapWithModalStack(component: ComponentWithProperties) {
    return new ComponentWithProperties(ModalStackComponent, { root: component });
}

const root = new ComponentWithProperties(AuthenticatedView, {
    noPermissionsRoot: wrapWithModalStack(getNoPermissionsView()),
    root: wrapWithModalStack(getRoot()),
    loginRoot: wrapWithModalStack(getLoginRoot()),
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
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {}),
    });

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {}),
    });

    const membersTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(MembersMenu, {}),
    });

    const organizationsTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(OrganizationsMenu, {}),
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
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`%GX`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ChargeMembershipsView, {}),
        }),
    });

    const eventNotificationsTab = new TabBarItem({
        id: 'event-notifications',
        icon: 'notification',
        name: $t(`%CV`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventNotificationsTableView, {}),
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

    const webshopsTab = new TabBarItem({
        id: 'webshops',
        icon: 'basket',
        name: $t('%1Pd'),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(WebshopsTableView, {}),
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
            root: new ComponentWithProperties(CommunicationView, {}),
        }),
    });

    return new ComponentWithProperties(TabBarController, {
        tabs: computed(() => {
            const tabs: (TabBarItem | TabBarItemGroup)[] = [
                startTab,
                membersTab,
            ];

            if (!STAMHOOFD.singleOrganization) {
                tabs.push(groupsTab);
            }

            if (platformManager.value.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', context.value)) {
                tabs.push(calendarTab);
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
