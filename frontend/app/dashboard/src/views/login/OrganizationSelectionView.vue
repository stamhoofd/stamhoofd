<template>
    <div class="st-view shade">
        <STNavigationBar v-if="!isNative" :large="true" :sticky="true">
            <template slot="left">
                <a alt="Stamhoofd" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener">
                    <Logo class="responsive" />
                </a>
            </template>

            <template slot="right">
                <a class="button primary" href="/aansluiten" @click.prevent="gotoSignup">
                    {{ $t("dashboard.join") }}
                </a>
            </template>
        </STNavigationBar>
        <STNavigationBar v-else :sticky="true" title="Kies jouw vereniging" />
        <main class="limit-width">
            <div class="organization-selection-view" :class="{native: isNative}">
                <a v-if="!isNative" class="button text" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener">
                    <span class="icon arrow-left" />
                    <span>Stamhoofd website</span>
                </a>
                <h1>Log in bij jouw vereniging</h1>
                <form class="input-icon-container icon search gray" @submit.prevent>
                    <input ref="input" v-model="query" class="input" placeholder="Zoek op postcode of naam" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" spellcheck="false" autocapitalize="off" @input="query = $event.target.value" @keydown.down.prevent="selectResult(0)">
                </form>
                <p v-if="!loading && filteredResults.length == 0 && !query">
                    Zoek en selecteer de vereniging waar je wilt inloggen of gebruik de knop bovenaan om een nieuwe vereniging aan te sluiten.
                </p>

                <Spinner v-if="loading" class="gray center" />
                <template v-else>
                    <button v-for="(organization, index) in filteredResults" :key="organization.id" ref="results" class="search-result" @keydown.down.prevent="selectResult(index + 1)" @keydown.up.prevent="selectResult(index - 1)" @click="loginOrganization(organization.id)">
                        <h1>{{ organization.name }}</h1>
                        <p>{{ organization.address }}</p>
                        <Spinner v-if="loadingSession === organization.id" class="floating" />
                        <span v-else-if="isSignedInFor(organization.id)" class="icon success floating" />
                        <span v-else class="icon arrow-right-small floating" />
                    </button>
                </template>

                <p v-if="!loading && filteredResults.length == 0 && query" class="info-box">
                    Geen verenigingen gevonden. Probeer te zoeken op postcode of naam.
                </p>

                <button class="button text full" @click="help">
                    <span class="icon help" />
                    <span>Mijn vereniging staat er niet tussen</span>
                </button>

                <a v-if="!isNative" href="/aansluiten" class="button text full" @click.prevent="gotoSignup">
                    <span class="icon add" />
                    <span>Nieuwe vereniging aansluiten</span>
                </a>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AsyncComponent, CenteredMessage, Logo, Spinner, STNavigationBar, Toast } from '@stamhoofd/components';
import { I18nController } from '@stamhoofd/frontend-i18n';
import { AppManager, NetworkManager, Session, SessionManager, UrlHelper } from '@stamhoofd/networking';
import { Organization, OrganizationSimple } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import LoginView from './LoginView.vue';

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();
            
        lastFunc = setTimeout(function() {
            if (Date.now() - lastRan >= limit) {
                func.apply(context, args);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};


// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        Spinner,
        STNavigationBar,
        Logo
    },
    metaInfo() {
        return {
            title: "Stamhoofd webapp | Beheer je vereniging",
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: "Via de Stamhoofd webapp kan je jouw vereniging beheren in je browser.",
                }
            ]
        }
    }
})
export default class OrganizationSelectionView extends Mixins(NavigationMixin){
    loading = false;
    loadingSession: string | null = null;
    q = ""
    results: OrganizationSimple[] = []

    get isNative() {
        return AppManager.shared.isNative
    }

    get query() {
        return this.q
    }

    set query(query: string) {
        this.q = query

        // update
        this.startUpdateResults();
    }

    help() {
        if (this.isNative) {
            new CenteredMessage("Vereniging niet gevonden", "In dit overzicht staan enkel verenigingen die al aangesloten zijn bij Stamhoofd. Een vereniging moet eerst aansluiten voor je kan inloggen.").addCloseButton("Sluiten").show()
        } else {
            new CenteredMessage("Vereniging niet gevonden", "In dit overzicht staan enkel verenigingen die al aangesloten zijn bij Stamhoofd. Je kan zelf een nieuwe vereniging aansluiten via de knop 'Nieuwe vereniging' bovenaan.").addCloseButton("Sluiten").show()
        }
    }

    gotoSignup() {
        this.present(
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ '../signup/SignupGeneralView.vue'), {})
            }).setDisplayStyle("popup")
        )
        plausible('openSignup');
    }

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        const queryString =  UrlHelper.shared.getSearchParams()

        if (parts.length >= 1 && parts[0] == 'aansluiten') {
            UrlHelper.shared.clear()
            try {
                const currentCount = localStorage.getItem("what-is-new")

                let code = queryString.get("code")
                let organization = queryString.get("org")

                if (currentCount !== null && (code || organization)) {
                    console.warn("Already has an organization. Skip referral discount.")
                    code = null;
                    organization = null;
                }
                this.present({
                    url: "/aansluiten",
                    adjustHistory: false,
                    components: [
                        new ComponentWithProperties(NavigationController, {
                            root: AsyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ '../signup/SignupGeneralView.vue'), { 
                                initialRegisterCode: code && organization ? {
                                    code,
                                    organization
                                } : null,
                                visitViaUrl: true
                            })
                        }).setDisplayStyle("popup").setAnimated(false)
                    ]
                })
                
            } catch (e) {
                console.error(e)
            }
        }

        if ((parts.length == 2 && parts[0] == 'auth' && parts[1] == 'nolt')) {
            // do not clear url here, so we can pass on the auth to the dashboard menu
            new Toast("Kies een vereniging en log in. Daarna kan je inloggen in het feedback systeem.", "error red").setHide(15*1000).show()
        }

        this.updateDefault().catch(console.error)
    }

    activated() {
        this.updateDefault().catch(console.error)
    }

    beforeDestroy() {
        Request.cancelAll(this)
    }

    throttleUpdateResults = throttle(this.updateResults.bind(this), 500);

    availableSessions: Session[] = []
    get defaultOrganizations(): Organization[] {
        return this.availableSessions.filter(s => !!s.organization).map(s => s.organization!)
    }

    async updateDefault() {
        this.availableSessions = await SessionManager.availableSessions()
    }

    get filteredResults() {
        if (this.query.length == 0) {
            return this.defaultOrganizations
        }
        return this.results
    }

    startUpdateResults() {
        if (this.query === this.lastQuery) {
            return
        }
        this.lastQuery = this.query
        this.loading = true
        this.counter++
        Request.cancelAll(this)

        if (this.query.length == 0) {
            this.results = []
            this.loading = false
            return
        }
        this.throttleUpdateResults()
    }

    counter = 0
    lastQuery = ""

    updateResults() {
        if (this.query.length == 0) {
            this.results = []
            this.loading = false
            return
        }
        this.loading = true
        let cachedCount = this.counter
        NetworkManager.server.request({
            method: "GET",
            path: "/organizations/search",
            query: {query: this.query },
            decoder: new ArrayDecoder(OrganizationSimple as Decoder<OrganizationSimple>),
            owner: this
        }).then((response) => {
            if (cachedCount !== this.counter) {
                // A new request have started already
                return
            }
            this.results = response.data
        }).catch(e => {
            if (cachedCount !== this.counter) {
                // A new request have started already
                return
            }
            console.error(e)
            Toast.fromError(e).show()
            this.results = []
        }).finally(() => {
            if (cachedCount !== this.counter) {
                // A new request have started already
                return
            }
            this.loading = false
        })
    }

    selectResult(index: number) {
        if (index === -1) {
            (this.$refs.input as HTMLInputElement).focus();
            return
        }
        if (this.$refs.results && this.$refs.results[index]) {
            this.$refs.results[index].focus()
        }
    }

    async loginOrganization(organizationId: string) {
        if (this.loadingSession) {
            return
        }
        this.loadingSession = organizationId

        if (document.activeElement) {
            // Blur currently focused element, to prevent from opening the login view multiple times
            (document.activeElement as HTMLElement).blur()
        }

        try {
            let session = await SessionManager.getSessionForOrganization(organizationId)
            if (!session) {
                session = new Session(organizationId)
                await session.loadFromStorage()
            }

            if (session.canGetCompleted()) {
                this.loadingSession = organizationId
                await SessionManager.setCurrentSession(session, false)
                this.loadingSession = null
                await this.updateDefault()
                if (!session.canGetCompleted() && !session.isComplete()) {
                    await this.loginOrganization(organizationId)
                    return
                }
                return
            }

            // Load the organization
            try {
                await session.fetchOrganization(false)
            } catch (e) {
                if (Request.isNetworkError(e)) {
                    // ignore if we already have an organization
                    if (!session.organization) {
                        throw e;
                    }
                    // Show network warning only
                    Toast.fromError(e).show()
                } else {
                    throw e;
                }
            }

            if (session.organization && this.defaultOrganizations.find(o => o.id === organizationId)) {
                // Update saved session (only if it was already added to the storage)
                SessionManager.addOrganizationToStorage(session.organization).catch(console.error)
            }

            // Switch locale to other country if needed
            if (session.organization) {
                I18nController.shared?.switchToLocale({ country: session.organization.address.country }).catch(console.error)
            }

            this.loadingSession = null
            this.present(new ComponentWithProperties(NavigationController, { 
                root: new ComponentWithProperties(LoginView, { 
                    session 
                }) 
            }).setDisplayStyle("sheet"))
        } catch (e) {
            this.loadingSession = null
            if (e.hasCode("invalid_organization")) {
                // Clear from session storage
                await SessionManager.removeOrganizationFromStorage(organizationId)
                Toast.fromError(new SimpleError({
                    code: "invalid_organization",
                    message: e.message,
                    human: "Deze vereniging bestaat niet (meer)"
                })).show()
            } else {
                Toast.fromError(e).show()
            }
            
            await this.updateDefault()
        }
    }

    isSignedInFor(organizationId: string) {
        const session = this.availableSessions.find(s => s.organizationId === organizationId)
        return session && session.canGetCompleted()
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use "~@stamhoofd/scss/base/text-styles.scss" as *;

.organization-selection-view {
    max-width: 500px;
    margin: 0 auto;
    width: 100%;

    @media (min-height: 800px) {
        padding-top: 40px;
    }

    &.native {
        padding-top: 0;
    }

    > h1 {
        @extend .style-title-1;
        padding-bottom: 10px;
    }

    > p:not([class]) {
        @extend .style-description;
        padding: 10px 0;
    }

    input.search {
        max-width: none;
    }

    > .spinner-container {
        padding: 10px 0;
    }

    > .search-result {
        @extend .style-input-shadow;
        background: $color-white;
        border: $border-width solid $color-border;
        padding: 20px 20px;
        border-radius: $border-radius;
        margin: 10px 0;
        transition: transform 0.2s, border-color 0.2s, background-color 0.2s;
        cursor: pointer;
        touch-action: manipulation;
        user-select: none;
        display: block;
        width: 100%;
        text-align: left;
        position: relative;

        > h1 {
            @extend .style-title-list;
            line-height: 1.2;
        }

        > .floating {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translate(0, -50%);
            color: $color-gray-1;
            transition: color 0.2s;
        }

        > p {
            @extend .style-description-small;
        }

        @media (hover: hover) {
            &:hover {
                border-color: $color-primary-gray-light;
                background-color: $color-primary-background;

                > .icon.floating {
                    color: $color-primary;
                }
            }
        }

        &:focus {
            // Create a hight contrast selection state, by adding multiple box shadows, to create a white border
            border-color: $color-primary;

            > .icon.floating {
                color: $color-primary;
            }
        }

        &:active {
            transform: scale(0.95, 0.95);
            border-color: $color-primary;

            > .icon.floating {
                color: $color-primary;
            }
        }
    }
}
</style>
