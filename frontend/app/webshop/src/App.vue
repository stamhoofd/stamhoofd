<template>
    <div id="app">
        <!--<ComponentWithPropertiesInstance :component="root" />-->
        <ModalStackComponent ref="modalStack" :root="root" />
        <ToastBox />
    </div>
</template>

<script lang="ts">
import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, ModalStackComponent, NavigationController, PushOptions } from "@simonbackx/vue-app-navigation";
import { AuthenticatedView, CenteredMessage, CenteredMessageView, ColorHelper, ErrorBox, LoadingView, ModalStackEventBus, PromiseView, Toast, ToastBox } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { DarkMode, GetWebshopFromDomainResult, WebshopAuthType } from '@stamhoofd/structures';
import { GoogleTranslateHelper } from '@stamhoofd/utility';
import { Component, Vue } from "vue-property-decorator";

import { WebshopManager } from './classes/WebshopManager';
import ChooseWebshopView from './views/ChooseWebshopView.vue';
import InvalidWebshopView from './views/errors/InvalidWebshopView.vue';
import PrerenderRedirectView from './views/errors/PrerenderRedirectView.vue';
import RequiredLoginView from './views/RequiredLoginView.vue';
import WebshopView from './views/WebshopView.vue';

@Component({
    components: {
        ModalStackComponent,
        ToastBox
    },
})
export default class App extends Vue {
    root = new ComponentWithProperties(PromiseView, {
        promise: async () => {
            // get organization
            try {
                // Check if we are on a global domain, and ignore /shops prefixes if needed
                let prefix: string | null = null
                const initialPath = UrlHelper.shared.getParts()
                const hostname = window.location.hostname

                if (Object.values(STAMHOOFD.domains.marketing).includes(hostname) && initialPath.length > 0 && initialPath[0] === STAMHOOFD.domains.webshopPrefix) {
                    console.info("Currently on our main domain, using fixed prefix:", STAMHOOFD.domains.webshopPrefix)
                    prefix = STAMHOOFD.domains.webshopPrefix
                }

                // Ignore this fixed prefix in our next lookup
                UrlHelper.fixedPrefix = prefix

                const ignorePath = ["checkout", "order", "cart", "payment", "tickets"];
                const path = UrlHelper.shared.getParts()
                const usedUri = path[0] && !ignorePath.includes(path[0]) ? path[0] : ''
                const response = await NetworkManager.server.request({
                    method: "GET",
                    path: "/webshop-from-domain",
                    query: {
                        domain: hostname,
                        uri: usedUri
                    },
                    decoder: GetWebshopFromDomainResult as Decoder<GetWebshopFromDomainResult>
                })

                // Yay, we have a webshop! Now mark the full suffix of this webshop as the fixed prefix, so we can just forget about it
                if (usedUri) {
                    if (UrlHelper.fixedPrefix) {
                        UrlHelper.fixedPrefix = UrlHelper.fixedPrefix + "/" + usedUri
                    } else {
                        UrlHelper.fixedPrefix = usedUri
                    }
                    console.info("Using fixed prefix", UrlHelper.fixedPrefix)
                }
                const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

                // Do we need to redirect?
                if (response.data.webshop) {
                    try {
                        const url = new URL("https://" + response.data.webshop.getUrl(response.data.organization));

                        if (window.location.hostname.toLowerCase() != url.hostname.toLowerCase()) {
                            // Redirect
                            const prefix = url.pathname.replace(/^\/+|\/+$/g, '');
                            // Remove starting and trailing slash
                            const u = UrlHelper.initial.getFullHref({ host: url.hostname, removePrefix: true, appendPrefix: prefix });

                            if (isPrerender) {
                                return new ComponentWithProperties(PrerenderRedirectView, { location: u })
                            }

                            window.location.href = u
                            return new ComponentWithProperties(LoadingView, {})
                        }
                    } catch (e) {
                        console.error(e)
                    }
                }

                I18nController.skipUrlPrefixForLocale = "nl-"+response.data.organization.address.country
                if (response.data.webshop) {
                    I18nController.forceCanonicalHostProtocolAndPrefix = "https://"+response.data.webshop.getUrl(response.data.organization)
                }
                await I18nController.loadDefault("webshop", response.data.organization.address.country, "nl", response.data.organization.address.country)

                // Set color
                if (response.data.webshop?.meta.color) {
                    ColorHelper.setColor(response.data.webshop.meta.color)
                } else if (response.data.organization.meta.color) {
                    ColorHelper.setColor(response.data.organization.meta.color)
                }
                ColorHelper.setDarkMode(response.data.webshop?.meta.darkMode ?? DarkMode.Off)

                // Set session
                const session = new Session(response.data.organization.id)
                await session.loadFromStorage()       
                session.setOrganization(response.data.organization)
                await session.checkSSO()
                await SessionManager.setCurrentSession(session)

                if (!response.data.webshop) {
                    if (response.data.webshops.length == 0) {
                        const marketingWebshops = "https://"+this.$t('shared.domains.marketing')+"/webshops"
                        if (isPrerender) {
                            return new ComponentWithProperties(PrerenderRedirectView, { location: marketingWebshops })
                        }
                        //window.location.href = marketingWebshops
                        return new ComponentWithProperties(InvalidWebshopView, {})
                    }
                    return new ComponentWithProperties(NavigationController, { 
                        root: new ComponentWithProperties(ChooseWebshopView, {
                            organization: response.data.organization,
                            webshops: response.data.webshops,
                        }) 
                    })
                }

                WebshopManager.organization = response.data.organization
                WebshopManager.webshop = response.data.webshop
                document.title = WebshopManager.webshop.meta.name +" - "+WebshopManager.organization.name

                // Do we need to require login?
                if (response.data.webshop.meta.authType === WebshopAuthType.Required) {
                    return new ComponentWithProperties(AuthenticatedView, {
                        root: new ComponentWithProperties(NavigationController, { 
                            root: new ComponentWithProperties(WebshopView, {}) 
                        }),
                        loginRoot: new ComponentWithProperties(ModalStackComponent, {
                            root: new ComponentWithProperties(NavigationController, { 
                                root: new ComponentWithProperties(RequiredLoginView, {}) 
                            })
                        })
                    });
                }

                return new ComponentWithProperties(NavigationController, { 
                    root: new ComponentWithProperties(WebshopView, {}) 
                })
            } catch (e) {
                console.log(e)
                // Check if we have an organization on this domain
                if (!I18nController.shared) {
                    try {
                        await I18nController.loadDefault("webshop", undefined, "nl")
                    } catch (e) {
                        console.error(e)
                    }
                }

                if (isSimpleError(e) || isSimpleErrors(e)) {
                    if (!(e.hasCode("invalid_domain") || e.hasCode("unknown_organization") || e.hasCode("unknown_webshop"))) {
                        Toast.fromError(e).show()

                        return new ComponentWithProperties(InvalidWebshopView, {
                            errorBox: new ErrorBox(e)
                        })
                    } 
                    // Redirect

                    const marketingWebshops = "https://"+this.$t('shared.domains.marketing')+"/webshops"

                    const isPrerender = navigator.userAgent.toLowerCase().indexOf('prerender') !== -1;

                    if (isPrerender) {
                        return new ComponentWithProperties(PrerenderRedirectView, { location: marketingWebshops })
                    }

                    //window.location.href = marketingWebshops
                }
                return new ComponentWithProperties(InvalidWebshopView, {})
            }
        }
    })

    created() {
        if (GoogleTranslateHelper.isGoogleTranslateDomain(window.location.hostname)) {
            // Enable translations
            document.documentElement.translate = true
        }

        if (STAMHOOFD.environment == "development") {
            //ComponentWithProperties.debug = true
        }
        HistoryManager.activate();
    }

    mounted() {
        ModalStackEventBus.addListener(this, "present", async (options: PushOptions | ComponentWithProperties) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            if (!(options as any).components) {
                (this.$refs.modalStack as any).present({ components: [options] });
            } else {
                (this.$refs.modalStack as any).present(options)
            }
        })
        
        CenteredMessage.addListener(this, async (centeredMessage) => {
            if (this.$refs.modalStack === undefined) {
                // Could be a webpack dev server error (HMR) (not fixable) or called too early
                await this.$nextTick()
            }
            (this.$refs.modalStack as any).present(
                {
                    components: [new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay")]
                }
            )
        })
    }
		
}
</script>

<style lang="scss">
// We need to include the component styling of vue-app-navigation first
@use "~@stamhoofd/scss/main";
@import "~@simonbackx/vue-app-navigation/dist/main.css";
@import "~@stamhoofd/scss/base/dark-modus";

body {
    --st-sheet-width: 450px;
}
</style>
