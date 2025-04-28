<template>
    <div id="app">
        <!--<ComponentWithPropertiesInstance :component="root" />-->
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, NavigationController, PushOptions, useManualPresent } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, CenteredMessageView, ColorHelper, ErrorBox, LoadingView, ModalStackEventBus, PromiseView, Toast, ToastBox } from '@stamhoofd/components';
import { I18nController, LocalizedDomains } from '@stamhoofd/frontend-i18n';
import { NetworkManager, SessionContext, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { DarkMode, GetWebshopFromDomainResult, Language } from '@stamhoofd/structures';
import { GoogleTranslateHelper } from '@stamhoofd/utility';

import { ref, watch } from 'vue';
import { getWebshopRootView } from './getRootView';
import ChooseWebshopView from './views/ChooseWebshopView.vue';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';
import PrerenderRedirectView from './views/errors/PrerenderRedirectView.vue';

const owner = {};
const root = new ComponentWithProperties(PromiseView, {
    promise: async () => {
        // get organization
        try {
            // Check if we are on a global domain, and ignore /shops prefixes if needed
            const hostname = window.location.hostname;

            // Ignore this fixed prefix in our next lookup
            UrlHelper.fixedPrefix = null;

            const ignorePath = ['checkout', 'order', 'cart', 'payment', 'tickets', 'code'];
            const path = UrlHelper.shared.getParts();
            const usedUri = path[0] && !ignorePath.includes(path[0]) ? path[0] : '';
            const response = await NetworkManager.server.request({
                method: 'GET',
                path: '/webshop-from-domain',
                query: {
                    domain: hostname,
                    uri: usedUri,
                },
                decoder: GetWebshopFromDomainResult as Decoder<GetWebshopFromDomainResult>,
            });

            // Yay, we have a webshop! Now mark the full suffix of this webshop as the fixed prefix, so we can just forget about it
            if (usedUri) {
                if (UrlHelper.fixedPrefix) {
                    UrlHelper.fixedPrefix = UrlHelper.fixedPrefix + '/' + usedUri;
                }
                else {
                    UrlHelper.fixedPrefix = usedUri;
                }
                console.info('Using fixed prefix', UrlHelper.fixedPrefix);
            }
            const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

            // Do we need to redirect?
            if (response.data.webshop) {
                try {
                    const url = new URL('https://' + response.data.webshop.getUrl(response.data.organization));

                    if (window.location.hostname.toLowerCase() !== url.hostname.toLowerCase()) {
                        // Redirect
                        const prefix = url.pathname.replace(/^\/+|\/+$/g, '');
                        // Remove starting and trailing slash
                        const u = UrlHelper.initial.getFullHref({ host: url.hostname, removePrefix: true, appendPrefix: prefix });

                        if (isPrerender) {
                            return new ComponentWithProperties(PrerenderRedirectView, { location: u });
                        }

                        window.location.href = u;
                        return new ComponentWithProperties(LoadingView, {});
                    }
                }
                catch (e) {
                    console.error(e);
                }
            }

            I18nController.skipUrlPrefixForLocale = 'nl-' + response.data.organization.address.country;

            // Set session
            const session = new SessionContext(response.data.organization);
            await session.loadFromStorage();

            await I18nController.loadDefault(session, response.data.organization.address.country, Language.Dutch, response.data.organization.address.country);

            await session.checkSSO();
            await SessionManager.prepareSessionForUsage(session);

            if (!response.data.webshop) {
                return new ComponentWithProperties(NavigationController, {
                    root: new ComponentWithProperties(ChooseWebshopView, {
                        organization: response.data.organization,
                        webshops: response.data.webshops,
                    }),
                });
            }

            const organization = response.data.organization;
            const webshop = response.data.webshop;

            document.title = webshop.meta.name + ' - ' + organization.name;

            return await getWebshopRootView(session, webshop);
        }
        catch (e) {
            console.log(e);
            // Check if we have an organization on this domain
            if (!I18nController.shared) {
                try {
                    await I18nController.loadDefault(null, undefined, Language.Dutch);
                }
                catch (e) {
                    console.error(e);
                }
            }

            if (isSimpleError(e) || isSimpleErrors(e)) {
                if (!(e.hasCode('invalid_domain') || e.hasCode('unknown_organization') || e.hasCode('unknown_webshop'))) {
                    Toast.fromError(e).show();

                    return new ComponentWithProperties(InvalidWebshopView, {
                        errorBox: new ErrorBox(e),
                    });
                }
                // Redirect

                const marketingWebshops = 'https://' + LocalizedDomains.marketing + '/webshops';

                const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

                if (isPrerender) {
                    return new ComponentWithProperties(PrerenderRedirectView, { location: marketingWebshops });
                }

                // window.location.href = marketingWebshops
            }
            return new ComponentWithProperties(InvalidWebshopView, {});
        }
    },
});

const modalStack = ref<typeof ModalStackComponent | null>(null);

function created() {
    if (GoogleTranslateHelper.isGoogleTranslateDomain(window.location.hostname)) {
        // Enable translations
        document.documentElement.translate = true;
    }

    if (STAMHOOFD.environment === 'development') {
        // ComponentWithProperties.debug = true
    }
    HistoryManager.activate();
}

created();
const manualPresent = useManualPresent();

watch(modalStack, (modalStack) => {
    if (modalStack === null) {
        return;
    }

    ModalStackEventBus.addListener(owner, 'present', async (options: PushOptions | ComponentWithProperties) => {
        if (!(options as any).components) {
            modalStack.present({ components: [options] });
        }
        else {
            modalStack.present(options);
        }
    });

    CenteredMessage.addListener(owner, async (centeredMessage) => {
        await manualPresent(modalStack.present, {
            components: [
                new ComponentWithProperties(CenteredMessageView, {
                    centeredMessage,
                }, {
                    forceCanHaveFocus: true,
                }),
            ],
            modalDisplayStyle: 'overlay',
        });
    });
});
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "@stamhoofd/scss/main";
@import "@simonbackx/vue-app-navigation/dist/main.css";
@import "@stamhoofd/scss/base/dark-modus";

body {
    --st-sheet-width: 450px;
}
</style>
