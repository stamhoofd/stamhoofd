import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, SplitViewController, setTitleSuffix } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AsyncComponent, AuthenticatedView, ContextNavigationBar, ContextProvider, LoginView, ManageEventsView, MembersTableView, NoPermissionsView, OrganizationSwitcher, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { PlatformManager, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Country } from '@stamhoofd/structures';
import { computed, markRaw, reactive } from 'vue';
import OrganizationsMenu from './views/organizations/OrganizationsMenu.vue';
import FinancesMenu from './views/finances/FinancesMenu.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, {root: component, initialPresents })
}

export async function getScopedAdminRootFromUrl() {
    const session = reactive(new SessionContext(null) as any) as SessionContext
    await session.loadFromStorage()
    await SessionManager.prepareSessionForUsage(session, false);

    await I18nController.loadDefault(session, Country.Belgium, "nl")

    return await getScopedAdminRoot(session)
}

export function getNoPermissionsView() {
    return  wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: 'Geen toegang',
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {})
                })
            })
        ]
    }))
}

export async function getScopedAdminRoot(session: SessionContext, options: {initialPresents?: PushOptions[]} = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const reactiveSession = reactive(session as any) as SessionContext
    I18nController.loadDefault(reactiveSession, Country.Belgium, "nl").catch(console.error)

    const platformManager = await PlatformManager.createFromCache(reactiveSession, true, true)

    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {})
    })

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {})
    })

    const membersTableView = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(MembersTableView, {})
    })

    const organizationsTableView = new ComponentWithProperties(SplitViewController, {
        root: new ComponentWithProperties(OrganizationsMenu, {})
    })

    setTitleSuffix('Administratie');

    const startTab =  new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView
    });

    const membersTab =  new TabBarItem({
        icon: 'group',
        name: 'Leden',
        component: membersTableView
    });

    const groupsTab =  new TabBarItem({
        icon: 'location',
        name: 'Groepen',
        component: organizationsTableView
    });

    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: 'Activiteiten',
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {})
        })
    });

    const financesTab =  new TabBarItem({
        icon: 'calculator',
        name: 'Boekhouding',
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(FinancesMenu, {})
        })
    });

    const settingsTab =  new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: settingsView
    });

    const moreTab = new TabBarItemGroup({
        icon: 'category',
        name: 'Meer',
        items: [
            financesTab,
            settingsTab
        ]
    });


    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: reactiveSession,
            $platformManager: platformManager,
            reactive_navigation_url: "administratie",
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {}),
                "tabbar-replacement": new ComponentWithProperties(ContextNavigationBar, {})
            },
            stamhoofd_app: 'admin'
        }),
        root: wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: computed(() => {
                            const tabs: (TabBarItem|TabBarItemGroup)[] = [
                                startTab,
                                membersTab,
                                groupsTab,
                                calendarTab
                            ]

                            if (reactiveSession.auth.hasFullPlatformAccess()) {
                                tabs.push(moreTab)
                            }

                            return tabs;
                        })
                    })
                ),
                loginRoot: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: [
                            new TabBarItem({
                                icon: 'key',
                                name: 'Inloggen',
                                component: new ComponentWithProperties(NavigationController, {
                                    root: new ComponentWithProperties(LoginView, {})
                                })
                            })
                        ]
                    })
                ),
                noPermissionsRoot: getNoPermissionsView()
            }), 
            options.initialPresents
        )
    });
}
