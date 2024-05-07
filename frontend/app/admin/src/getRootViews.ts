import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix } from '@simonbackx/vue-app-navigation';
import { AccountSwitcher, AsyncComponent, AuthenticatedView, ContextProvider, OrganizationSwitcher, TabBarController, TabBarItem, TabBarItemGroup, LoginView } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { SessionContext, SessionManager } from '@stamhoofd/networking';
import { Country } from '@stamhoofd/structures';

import { computed, reactive } from 'vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, {root: component, initialPresents })
}

export async function getScopedAdminRootFromUrl() {
    const session = new SessionContext(null)
    await session.loadFromStorage()
    await SessionManager.prepareSessionForUsage(session, false);

    await I18nController.loadDefault(session, "admin", Country.Belgium, "nl")

    return getScopedAdminRoot(session)
}

export function getScopedAdminRoot(session: SessionContext, options: {initialPresents?: PushOptions[]} = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    I18nController.loadDefault(session, "dashboard", Country.Belgium, "nl").catch(console.error)
    const reactiveSession = reactive(session) as SessionContext

    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "StartView", webpackPrefetch: true */ './views/start/StartView.vue'), {})
    })

    setTitleSuffix('Administratie');

    const startTab =  new TabBarItem({
        icon: 'home',
        name: 'Start',
        component: startView
    });

    const moreTab = new TabBarItemGroup({
        icon: 'category',
        name: 'Meer',
        items: []
    });

    return new ComponentWithProperties(ContextProvider, {
        context: {
            $context: reactiveSession,
            reactive_navigation_url: "administratie",
            reactive_components: {
                "tabbar-left": new ComponentWithProperties(OrganizationSwitcher, {}),
                "tabbar-right": new ComponentWithProperties(AccountSwitcher, {})
            },
            stamhoofd_app: 'admin'
        },
        calculatedContext: () => {
            return {
                $user: computed(() => reactiveSession.user),
            }
        },
        root: wrapWithModalStack(
            new ComponentWithProperties(AuthenticatedView, {
                root: wrapWithModalStack(
                    new ComponentWithProperties(TabBarController, {
                        tabs: computed(() => {
                            const tabs: (TabBarItem|TabBarItemGroup)[] = [
                                startTab
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
                )
            }), 
            options.initialPresents
        )
    });
}
