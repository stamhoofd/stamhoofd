import { Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, ModalStackComponent, NavigationController, UrlHelper } from '@simonbackx/vue-app-navigation';
import { AuthenticatedView, ColorHelper, manualFeatureFlag, PromiseView, TabBarController, TabBarItem } from '@stamhoofd/components';
import { getNonAutoLoginRoot, sessionFromOrganization, wrapContext } from '@stamhoofd/dashboard';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, SessionContext, SessionManager } from '@stamhoofd/networking';
import { Country, Organization } from '@stamhoofd/structures';
import { computed } from 'vue';

import CartView from './views/cart/CartView.vue';
import EventsOverview from './views/events/EventsOverview.vue';
import StartView from './views/start/StartView.vue';

export function wrapWithModalStack(...components: ComponentWithProperties[]) {
    return new ComponentWithProperties(ModalStackComponent, { initialComponents: components });
}

export async function getScopedRegistrationRootFromUrl() {
    const parts = UrlHelper.shared.getParts();
    const ignoreUris = ['login', 'start', 'mandje'];

    let session: SessionContext | null = null;

    if (STAMHOOFD.singleOrganization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    else if (parts[0] === 'leden' && parts[1] && !ignoreUris.includes(parts[1])) {
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
        }
    }

    if (!session || !session.organization) {
        if (STAMHOOFD.userMode === 'platform' && parts[0] === 'leden') {
            session = new SessionContext(null);
            await session.loadFromStorage();
            await session.checkSSO();
            await SessionManager.prepareSessionForUsage(session, true);
            return await getRootView(session);
        }
        const dashboard = await import('@stamhoofd/dashboard');
        return dashboard.getOrganizationSelectionRoot(new SessionContext(null));
    }

    return await getRootView(session);
}

export async function getRootView(session: SessionContext, ownDomain = false) {
    if (STAMHOOFD.singleOrganization && !session.organization) {
        session = await sessionFromOrganization({ organizationId: STAMHOOFD.singleOrganization });
    }
    await I18nController.loadDefault(session, Country.Belgium, 'nl', session?.organization?.address?.country);

    // Set color
    if (session.organization?.meta.color && ownDomain) {
        ColorHelper.setColor(session.organization?.meta.color);
    }

    const startView = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(StartView, {}),
    });

    const cartRoot = new ComponentWithProperties(NavigationController, {
        root: new ComponentWithProperties(CartView, {}),
    });

    const calendarTab = new TabBarItem({
        icon: 'calendar',
        name: $t(`d9b4472a-a395-4877-82fd-da6cb0140594`),
        component: new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(EventsOverview, {}),
        }),
    });

    return wrapContext(session, 'registration', ({ platformManager }) => new ComponentWithProperties(AuthenticatedView, {
        root: wrapWithModalStack(
            new ComponentWithProperties(PromiseView, {
                promise: async function (this: PromiseView) {
                    const $memberManager = this.$memberManager;
                    await $memberManager.loadMembers();
                    await $memberManager.loadCheckout();
                    await $memberManager.loadDocuments();

                    const enableEvents = platformManager.$platform.config.eventTypes.length > 0 && !manualFeatureFlag('disable-events', session);

                    return new ComponentWithProperties(TabBarController, {
                        tabs: [
                            new TabBarItem({
                                icon: 'home',
                                name: $t(`04548161-abc0-4bea-bdd3-fdbacddc22f8`),
                                component: startView,
                            }),
                            ...(enableEvents ? [calendarTab] : []),
                            new TabBarItem({
                                icon: 'basket',
                                name: $t(`88db9833-34e4-488a-9f74-b6e230c69dc1`),
                                component: cartRoot,
                                badge: computed(() => $memberManager.family.checkout.cart.count == 0 ? '' : $memberManager.family.checkout.cart.count.toFixed(0)),
                            }),
                        ],
                    });
                },
            }),
        ),
        loginRoot: wrapWithModalStack(
            getNonAutoLoginRoot(session),
        ),
    }), { ownDomain });
}
