import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AsyncComponent, AuthenticatedView, ContextProvider, LoginView, NoPermissionsView, OrganizationSwitcher, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { PlatformManager, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Country } from '@stamhoofd/structures';

import { computed, reactive } from 'vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, {root: component, initialPresents })
}

export async function getScopedAdminRootFromUrl() {
    const session = reactive(new SessionContext(null)) as SessionContext
    await session.loadFromStorage()
    await SessionManager.prepareSessionForUsage(session, false);

    await I18nController.loadDefault(session, "admin", Country.Belgium, "nl")

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
    const reactiveSession = reactive(session) as SessionContext
    I18nController.loadDefault(reactiveSession, "dashboard", Country.Belgium, "nl").catch(console.error)

    const platformManager = await PlatformManager.createFromCache(reactiveSession, true, true)

    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/start/StartView.vue'), {})
    })

    const settingsView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import('./views/settings/SettingsView.vue'), {})
    })

    setTitleSuffix('Administratie');

    const startTab =  new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView
    });

    const settingsTab =  new TabBarItem({
        icon: 'settings',
        name: 'Instellingen',
        component: settingsView
    });

    const moreTab = new TabBarItemGroup({
        icon: 'category',
        name: 'Meer',
        items: []
    });

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            $platform: computed(() => platformManager.$platform),
            $user: computed(() => reactiveSession.user),
            $platformManager: platformManager,
            reactive_navigation_url: "administratie",
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {})
            },
            stamhoofd_app: 'admin'
        },
        root: wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: computed(() => {
                            const tabs: (TabBarItem|TabBarItemGroup)[] = [
                                startTab,
                                settingsTab
                            ]

                            tabs.push(moreTab);

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
