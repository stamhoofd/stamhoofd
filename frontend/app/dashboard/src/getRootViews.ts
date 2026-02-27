import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, PushOptions, setTitleSuffix, SplitViewController } from '@simonbackx/vue-app-navigation';
import { CommunicationView, AccountSwitcher, AsyncComponent, AuditLogsView, AuthenticatedView, ContextNavigationBar, ContextProvider, CoverImageContainer, CustomHooksContainer, LoginView, ManageEventsView, manualFeatureFlag, NoPermissionsView, OrganizationLogo, OrganizationSwitcher, PromiseView, ReplaceRootEventBus, TabBarController, TabBarItem, TabBarItemGroup } from '@stamhoofd/components';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { MemberManager, NetworkManager, OrganizationManager, PlatformManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { AccessRight, AppType, Organization, PermissionLevel, PermissionsResourceType, Webshop } from '@stamhoofd/structures';
import { computed, markRaw, onUnmounted, reactive, ref } from 'vue';

import { SimpleError } from '@simonbackx/simple-errors';
import RedirectView from '@stamhoofd/components/auth/RedirectView.vue';
import { CheckoutManager } from '../../webshop/src/classes/CheckoutManager';
import { WebshopManager } from '../../webshop/src/classes/WebshopManager';
import { WhatsNewCount } from './classes/WhatsNewCount';
import { useGlobalRoutes } from './useGlobalRoutes';
import OrganizationSelectionView from './views/login/OrganizationSelectionView.vue';

export function wrapWithModalStack(component: ComponentWithProperties, initialPresents?: PushOptions[]) {
    return new ComponentWithProperties(ModalStackComponent, { root: component, initialPresents });
}

export async function wrapContext(context: SessionContext, app: AppType | 'auto', buildComponent: ComponentWithProperties | ((data: { platformManager: PlatformManager }) => ComponentWithProperties), options?: { ownDomain?: boolean; initialPresents?: PushOptions[]; webshop?: Webshop }) {
    const platformManager = await PlatformManager.createFromCache(context, app, true);
    const $memberManager = new MemberManager(context, platformManager.$platform);

    if (app === 'webshop' && !options?.webshop) {
        throw new Error('Webshop is required for webshop app');
    }

    const $webshopManager = options?.webshop ? reactive(new WebshopManager(context, platformManager.$platform, options.webshop) as any) as WebshopManager : null;
    const $checkoutManager = $webshopManager ? reactive(new CheckoutManager($webshopManager)) : null;

    const component = typeof buildComponent === 'function' ? buildComponent({ platformManager }) : buildComponent;

    return new ComponentWithProperties(ContextProvider, {
        context: markRaw({
            $context: context,
            $platformManager: platformManager,
            $memberManager,
            $organizationManager: new OrganizationManager(context),
            $webshopManager,
            $checkoutManager,
            reactive_components: {
                'tabbar-left': options?.ownDomain && context.organization
                    ? new ComponentWithProperties(OrganizationLogo, {
                        organization: context.organization,
                    })
                    : new ComponentWithProperties(OrganizationSwitcher, {}),
                'tabbar-right': new ComponentWithProperties(AccountSwitcher, {}),
                'tabbar-replacement': new ComponentWithProperties(ContextNavigationBar, {}),
            },
            stamhoofd_app: app,
        }),
        root: wrapWithModalStack(new ComponentWithProperties(CustomHooksContainer, {
            root: component,
            hooks: () => {
                useGlobalRoutes();
                // Since we mounted, clear the inititial presents
                onUnmounted(() => {
                    // Clear the initial presents again, so that we don't keep them in memory
                    if (options?.initialPresents) {
                        console.log('Clearing initial presents', options.initialPresents);
                        options?.initialPresents?.splice(0);
                    }
                });
            },
        }), options?.initialPresents),
    });
}

export async function sessionFromOrganization(data: ({ organization: Organization } | { organizationId: string })) {
    const session = await SessionContext.createFrom(data);
    await session.loadFromStorage();
    await session.checkSSO();
    if ('organization' in data) {
        // Up to date organization
        session.setOrganization(data.organization);
        session._lastFetchedOrganization = new Date();
    }
    await SessionManager.prepareSessionForUsage(session, false);
    return session;
}

export async function loadSessionFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'aansluiten', 'start', 'activiteiten', 'mandje', $t(`39c566d6-520d-4048-bb1a-53eeea3ccea7`)];

    let session: SessionContext | null = null;

    console.log('load session', parts);

    if (STAMHOOFD.singleOrganization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    else if (parts[1] && !ignoreUris.includes(parts[1])) {
        const uri = parts[1];

        // Load organization
        // todo: use cache
        try {
            const response = await NetworkManager.server.request({
                method: 'GET',
                path: '/organization-from-uri',
                query: {
                    uri,
                },
                decoder: Organization as Decoder<Organization>,
            });
            const organization = response.data;
            session = await sessionFromOrganization({ organization });
        }
        catch (e) {
            console.error('Failed to load organization from uri', uri);
            session = null;
        }
    }

    if (!session) {
        session = await SessionManager.getLastGlobalSession();
        await SessionManager.prepareSessionForUsage(session, false);
        await session.checkSSO();
    }

    return session;
}

export function getLoginRoot() {
    if (STAMHOOFD.REDIRECT_LOGIN_DOMAIN && UrlHelper.initial.getSearchParams().get('skipRedirect') !== 'true') {
        const urlCopy = new URL(UrlHelper.initial.url);
        urlCopy.hostname = STAMHOOFD.REDIRECT_LOGIN_DOMAIN;

        return new ComponentWithProperties(RedirectView, {
            location: urlCopy.href,
        });
    }

    const base = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: UrlHelper.shared.getSearchParams().get('email') ?? '',
            }),
        }),
    });

    return base;
}

export function getNonAutoLoginRoot(reactiveSession: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    // In platform mode, we always redirect to the 'auto' login view, so that we redirect the user to the appropriate environment after signin in
    // if (STAMHOOFD.userMode === 'platform') {
    return new ComponentWithProperties(PromiseView, {
        promise: async () => {
            // Replace itself again after a successful login
            const root = await getScopedAutoRoot(reactiveSession, options);
            await ReplaceRootEventBus.sendEvent('replace', root);
            return new ComponentWithProperties({}, {});
        },
    });
    // }

    // return getLoginRoot();
}

export async function getOrganizationSelectionRoot(session: SessionContext) {
    let baseRoot = new ComponentWithProperties(CoverImageContainer, {
        root: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(OrganizationSelectionView, {}),
        }),
    });

    if (STAMHOOFD.userMode === 'platform') {
        // In platform mode, we need authentication
        baseRoot = new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(baseRoot),

            // If a user gets logged out on the organization selection root, we'll replace the root with the auto selection root
            // This is because we want the user to automatically go to the right place after signing in
            loginRoot: wrapWithModalStack(getNonAutoLoginRoot(session)),
        });
    }

    return await wrapContext(session, 'auto', baseRoot);
}

export function getNoPermissionsView() {
    return wrapWithModalStack(new ComponentWithProperties(TabBarController, {
        tabs: [
            new TabBarItem({
                icon: 'key',
                name: $t(`6fef52a1-82a9-456f-a51e-b32eea13b889`),
                component: new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(NoPermissionsView, {}),
                }),
            }),
        ],
    }));
}

export async function getScopedDashboardRootFromUrl() {
    // UrlHelper.fixedPrefix = "beheerders";
    const session = await loadSessionFromUrl();

    if (!session.organization) {
        // Invalid URL
        return getScopedAutoRoot(session);
    }

    return await getScopedDashboardRoot(session);
}

export async function getScopedAutoRootFromUrl() {
    const session = await loadSessionFromUrl();
    return await getScopedAutoRoot(session);
}

export async function getScopedAutoRoot(session: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    if (!session.user) {
        if (!session.organization && STAMHOOFD.userMode === 'organization') {
            return getOrganizationSelectionRoot(session);
        }

        // We can't really determine the automatic root view because we are not signed in
        // So return the login view, that will call getScopedAutoRoot again after login
        const reactiveSession = session;

        return await wrapContext(reactiveSession, 'auto',
            new ComponentWithProperties(AuthenticatedView, {
                root: new ComponentWithProperties(PromiseView, {
                    promise: async () => {
                        if (reactiveSession.user) {
                            // Replace itself again after a successful login
                            const root = await getScopedAutoRoot(reactiveSession, options);
                            await ReplaceRootEventBus.sendEvent('replace', root);
                        }
                        else {
                            throw new SimpleError({
                                code: 'infinite_redirect',
                                message: $t('a600bbdb-779a-4f6d-bc60-16c15eeaebe9'),
                            });
                        }
                        return new ComponentWithProperties({}, {});
                    },
                }),
                loginRoot: wrapWithModalStack(getLoginRoot()),
            }),
            options,
        );
    }

    if (STAMHOOFD.singleOrganization && !session.organization) {
        // Try to load the default organization
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }

    // Load the platform manager so we can calculate permissions correctly
    await PlatformManager.createFromCache(session, 'auto', true);

    // Make sure users without permissions always go to the member portal automatically
    if (
        (
            (!session.organization && (!session.auth.userPermissions || session.auth.userPermissions.isEmpty)) // note: we cannot use .isEmpty because the platform is not yet loaded and we cannot detect inheritance
            || (session.organization && (!session.auth.permissions || session.auth.permissions.isEmpty))
        ) && (
            STAMHOOFD.userMode === 'platform'
            || (session.organization && session.organization.meta.packages.useMembers)
        )
    ) {
        const registration = await import('@stamhoofd/registration');
        return await registration.getRootView(session);
    }

    if (session.organization) {
        return await getScopedDashboardRoot(session, options);
    }

    // Users with permissions should always have the option to choose the member portal or the dashboard
    return getOrganizationSelectionRoot(session);
}

export async function getScopedDashboardRoot(reactiveSession: SessionContext, options: { initialPresents?: PushOptions[] } = {}) {
    // When switching between organizations, we allso need to load the right locale, which can happen async normally
    const startView = new ComponentWithProperties(NavigationController, {
        root: AsyncComponent(() => import(/* webpackChunkName: "StartView", webpackPrefetch: true */ './views/start/StartView.vue'), {}),
    });

    setTitleSuffix(reactiveSession.organization?.name ?? '');

    const startTab = new TabBarItem({
        id: 'start',
        icon: 'home',
        name: $t(`3e23e0d2-ec8c-44f9-92fa-a1fce10c0185`),
        component: startView,
    });

    const membersTab = new TabBarItem({
        id: 'members',
        icon: 'group',
        name: $t(`fb35c140-e936-4e91-aa92-ef4dfc59fb51`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/members/MembersMenu.vue'), {}),
        }),
    });

    const calendarTab = new TabBarItem({
        id: 'events',
        icon: 'calendar',
        name: $t(`6ec2f1fd-3f8f-4814-9442-e628eea062a3`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(ManageEventsView, {}),
        }),
    });

    const webshopsTab = new TabBarItem({
        id: 'webshops',
        icon: 'basket',
        name: $t(`dcddc3ae-d5cb-4e28-b7bd-a38020ce64ba`),
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
        }
        else {
            localStorage.setItem('what-is-new', (WhatsNewCount as any).toString());
        }
    };
    loadWhatsNew();

    const settingsTab = new TabBarItem({
        id: 'settings',
        icon: 'settings',
        name: $t(`5ca94078-d742-4e17-abf7-957c4721a559`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/SettingsView.vue'), {}),
        }),
    });

    const financesTab = new TabBarItem({
        id: 'finances',
        icon: 'calculator',
        name: $t(`9bd091b0-0e9f-41f9-8896-8f2b9e64550c`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/settings/FinancesView.vue'), {}),
        }),
    });

    const documentsTab = new TabBarItem({
        id: 'documents',
        icon: 'file-filled',
        name: $t(`57ecaa64-a660-40fd-abf3-0bcf541ed8e6`),
        component: new ComponentWithProperties(SplitViewController, {
            root: AsyncComponent(() => import('./views/dashboard/documents/DocumentTemplatesView.vue'), {}),
        }),
    });

    const auditLogsTab = new TabBarItem({
        id: 'audit-logs',
        icon: 'history',
        name: $t(`b33a8267-18b5-4775-94b0-64bdcae3bfa4`),
        component: new ComponentWithProperties(SplitViewController, {
            root: new ComponentWithProperties(AuditLogsView, {}),
        }),
    });

    const communicationTab = new TabBarItem({
        id: 'communication',
        icon: 'email-filled',
        name: $t(`a6304a41-8c83-419b-8e7e-c26f4a047c19`),
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
                name: $t(`1b84643d-ab39-4c9e-89d9-ebfa98277a40`),
                badge: whatsNewBadge,
                action: async function () {
                    window.open(STAMHOOFD.CHANGELOG_URL![STAMHOOFD.fixedCountry ?? reactiveSession.organization?.address?.country ?? ''] ?? STAMHOOFD.CHANGELOG_URL![''], '_blank');
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
                name: $t(`031cfca3-ca9a-44cc-95b5-03c81948f765`),
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
                name: $t(`630ab37a-85c8-4bbd-a281-b87e82a976d5`),
                action: async function () {
                    const NoltHelper = (await import('./classes/NoltHelper'));
                    await NoltHelper.openNolt(reactiveSession, false);
                },
            }),
        );
    }
    else if (STAMHOOFD.FEEDBACK_URL) {
        sharedMoreItems.push(
            new TabBarItem({
                id: 'feedback',
                icon: 'feedback',
                name: $t(`630ab37a-85c8-4bbd-a281-b87e82a976d5`),
                action: async function () {
                    window.open(STAMHOOFD.FEEDBACK_URL!, '_blank');
                },
            }),
        );
    }

    return wrapContext(reactiveSession, 'dashboard',
        ({ platformManager }) => new ComponentWithProperties(AuthenticatedView, {
            root: wrapWithModalStack(
                new ComponentWithProperties(TabBarController, {
                    tabs: computed(() => {
                        const organization = reactiveSession.organization;

                        const tabs: (TabBarItem | TabBarItemGroup)[] = [
                            startTab,
                        ];

                        if (organization?.meta.packages.useMembers || STAMHOOFD.environment === 'development') {
                            tabs.push(membersTab);
                        }

                        if (platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', reactiveSession)) {
                            tabs.push(calendarTab);
                        }

                        if (organization?.meta.packages.useWebshops && STAMHOOFD.domains.webshop) {
                            if (reactiveSession.auth.hasAccessRight(AccessRight.OrganizationCreateWebshops) || !!organization.webshops.find(w => reactiveSession.auth.canAccessWebshop(w, PermissionLevel.Read))) {
                                tabs.push(webshopsTab);
                            }
                        }

                        const moreTab = new TabBarItemGroup({
                            icon: 'category',
                            name: $t(`95bb5f36-a709-4724-bf21-9793911af5d6`),
                            items: [
                                ...sharedMoreItems, // need to create a new array, don't pass directly!
                            ],
                        });

                        if (reactiveSession.auth.hasFullAccess()) {
                            moreTab.items.unshift(auditLogsTab);
                            moreTab.items.unshift(documentsTab);
                            moreTab.items.unshift(financesTab);
                            moreTab.items.unshift(communicationTab);
                            moreTab.items.unshift(settingsTab);
                        }
                        else {
                            if (reactiveSession.auth.hasAccessRight(AccessRight.OrganizationManagePayments)) {
                                moreTab.items.unshift(financesTab);
                            }

                            if (reactiveSession.auth.hasAccessForSomeResourceOfType(PermissionsResourceType.Senders)) {
                                moreTab.items.unshift(communicationTab);
                            }
                        }

                        if (moreTab.items.length > 0) {
                            tabs.push(moreTab);
                        }

                        return tabs;
                    }),
                }),
            ),
            loginRoot: wrapWithModalStack(getNonAutoLoginRoot(reactiveSession, options)),
            noPermissionsRoot: getNoPermissionsView(),
        }),
        options,
    );
}
