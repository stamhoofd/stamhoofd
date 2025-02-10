import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { AsyncComponent, AuditLogsView, AuthenticatedView, ManageEventsView, manualFeatureFlag, MembersTableView, NoPermissionsView, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { getNonAutoLoginRoot, wrapContext } from '@stamhoofd/dashboard';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { SessionContext, SessionManager } from '@stamhoofd/networking';
import { computed } from 'vue';
import ChargeMembershipsView from './views/finances/ChargeMembershipsView.vue';
import OrganizationsMenu from './views/organizations/OrganizationsMenu.vue';
import EventNotificationsTableView from './views/event-notifications/EventNotificationsTableView.vue';
import { AccessRight, PermissionsResourceType } from '@stamhoofd/structures';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, { root: component, initialPresents });
}

export async function getScopedAdminRootFromUrl({ $t }: { $t: ReturnType<typeof useTranslate> }) {
    const session = new SessionContext(null);
    await session.loadFromStorage();
    await session.checkSSO();
    await SessionManager.prepareSessionForUsage(session, false);

    return await getScopedAdminRoot(session, $t);
}

export function getNoPermissionsView() {
    return wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: 'Geen toegang',
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    }));
}

export async function getScopedAdminRoot(reactiveSession: SessionContext, $t: ReturnType<typeof useTranslate>, options: { initialPresents?: PushOptions[] } = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {}),
    });

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {}),
    });

    const membersTableView = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MembersTableView, {}),
    });

    const organizationsTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(OrganizationsMenu, {}),
    });

    setTitleSuffix('Administratie');

    const startTab = new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView,
    });

    const membersTab = new TabBarItem({
        icon: 'group',
        name: 'Leden',
        component: membersTableView,
    });

    const groupsTab = new TabBarItem({
        icon: 'location',
        name: computed(() => $t('6e884f27-427f-4f85-914c-d5c2780253b0')),
        component: organizationsTableView,
    });

    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: 'Activiteiten',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const financesTab = new TabBarItem({
        icon: 'calculator',
        name: 'Boekhouding en aansluitingen',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ChargeMembershipsView, {}),
        }),
    });

    const eventNotificationsTab = new TabBarItem({
        icon: 'notification',
        name: 'Kampmeldingen',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventNotificationsTableView, {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        icon: 'history',
        name: 'Logboek',
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const settingsTab = new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: settingsView,
    });

    return wrapContext(reactiveSession, 'admin', wrapWithModalStack(
        new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: computed(() => {
                        const tabs: (TabBarItem | TabBarItemGroup)[] = [
                            startTab,
                            membersTab,
                            groupsTab,
                            calendarTab,
                        ];

                        const moreTab = new TabBarItemGroup({
                            icon: 'category',
                            name: 'Meer',
                            items: [
                            ],
                        });

                        if (reactiveSession.auth.hasFullAccess()) {
                            moreTab.items.push(settingsTab);
                            moreTab.items.push(financesTab);

                            if (manualFeatureFlag('audit-logs', reactiveSession)) {
                                // Feature is still in development so not visible for everyone
                                moreTab.items.push(auditLogsTab);
                            }
                        }

                        if (manualFeatureFlag('event-notifications', reactiveSession) && reactiveSession.auth.hasAccessRightForSomeResource(PermissionsResourceType.OrganizationTags, AccessRight.OrganizationEventNotificationReviewer)) {
                            // Feature is still in development so not visible for everyone
                            moreTab.items.push(eventNotificationsTab);
                        }

                        if (moreTab.items.length > 0) {
                            tabs.push(moreTab);
                        }

                        return tabs;
                    }),
                }),
            ),
            loginRoot: wrapWithModalStack(
                getNonAutoLoginRoot(reactiveSession, options),
            ),
            noPermissionsRoot: getNoPermissionsView(),
        }),
        options.initialPresents,
    ));
}
