<template>
    <div>
        <STGradientBackground />

        <div class="st-view background transparent">
            <STNavigationBar v-if="!isNative" :large="true" class="transparent">
                <template slot="left">
                    <a alt="Stamhoofd" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener" class="logo-container">
                        <Logo class="responsive" />
                        <span class="logo-text horizontal hide-medium">Beheerders</span>
                    </a>
                </template>

                <template slot="right">
                    <a v-if="!isNative" class="button text only-icon-smartphone" :href="'https://'+$t('shared.domains.marketing')+''" rel="noopener">
                        <span class="icon external" />
                        <span>Terug naar website</span>
                    </a>

                    <a v-if="!isNative" class="button primary" href="/aansluiten" @click.prevent="gotoSignup">
                        {{ $t("dashboard.join") }}
                    </a>
                </template>
            </STNavigationBar>
            <STNavigationBar v-else title="Beheer jouw vereniging" class="transparent" />

            <main class="limit-width">
                <div class="organization-selection-view" :class="{native: isNative}">
                    <h1>
                        Beheer jouw vereniging
                    </h1>
                    <p v-if="!isNative" class="style-description-block style-description-large">
                        Welkom op het dashboard voor beheerders van verenigingen op Stamhoofd. Als jouw vereniging als is aangesloten bij Stamhoofd, kan je die hieronder zoeken.
                    </p>
                    <p v-else class="style-description-block style-description-large">
                        Welkom in de Stamhoofd app voor beheerders. Als jouw vereniging al is aangesloten bij Stamhoofd, kan je die hieronder zoeken.
                    </p>

                    <form class="input-icon-container icon search gray" @submit.prevent>
                        <input ref="input" v-model="query" class="input" placeholder="Zoek op naam of postcode" name="search" inputmode="search" type="search" enterkeyhint="search" autocorrect="off" autocomplete="off" spellcheck="false" autocapitalize="off" @input="query = $event.target.value" @keydown.down.prevent="selectResult(0)">
                    </form>

                    <div v-if="showDevelopment" class="version-box">
                        <VersionFooter />
                    </div>
                    <Spinner v-else-if="loading" class="gray center" />
                    <template v-else>
                        <button v-for="(organization, index) in filteredResults" :key="organization.id" ref="results" type="button" class="search-result" @keydown.down.prevent="selectResult(index + 1)" @keydown.up.prevent="selectResult(index - 1)" @click="loginOrganization(organization)">
                            <OrganizationAvatar :organization="organization" />
                            <div>
                                <h1>{{ organization.name }}</h1>
                                <p>{{ organization.address.anonymousString($country) }}</p>
                                <Spinner v-if="loadingSession === organization.id" class="floating" />
                                <span v-else-if="isSignedInFor(organization.id)" class="icon success primary floating" />
                                <span v-else class="icon arrow-right-small gray floating" />
                            </div>
                        </button>
                    </template>

                    <p v-if="!loading && filteredResults.length == 0 && query && !showDevelopment" class="info-box">
                        Geen verenigingen gevonden. Probeer te zoeken op postcode of naam. Is jouw vereniging nog niet aangesloten? Maak dan eerst een vereniging aan.
                    </p>

                    <footer v-if="!showDevelopment">
                        <a v-if="!isNative" href="/aansluiten" class="button text full selected" @click.prevent="gotoSignup">
                            <span class="icon add" />
                            <span>Mijn vereniging aansluiten</span>
                        </a>

                        <button class="button text full" type="button" @click="help">
                            <span class="icon help" />
                            <span>Mijn vereniging staat er niet tussen</span>
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { Request } from '@simonbackx/simple-networking';
import { ComponentWithProperties, ModalStackComponentFinderMixin, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { AsyncComponent, CenteredMessage, Logo, OrganizationAvatar, Spinner, STGradientBackground, STNavigationBar, Toast } from '@stamhoofd/components';
import { AppManager, NetworkManager, Session, SessionManager, Storage, UrlHelper } from '@stamhoofd/networking';
import { Organization } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { getScopedDashboardRoot } from '../../getRootViews';
import VersionFooter from '../dashboard/settings/VersionFooter.vue';

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
        Logo,
        OrganizationAvatar,
        STGradientBackground,
        VersionFooter
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
export default class OrganizationSelectionView extends Mixins(NavigationMixin, ModalStackComponentFinderMixin){
    loading = false;
    loadingSession: string | null = null;
    q = ""
    results: Organization[] = []

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

    get showDevelopment() {
        return this.q.toLocaleLowerCase().trim() === 'stamhoofd dev'
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

        console.log(parts, queryString)

        if (parts.length >= 1 && parts[0] == 'aansluiten') {
            try {
                let code = queryString.get("code")
                let organization = queryString.get("org")
                this.present({
                    url: UrlHelper.transformUrl("/aansluiten"),
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
        } else {
            UrlHelper.shared.clear()

            // Reset url if we log out
            console.log('seturl', '/')
            UrlHelper.setUrl("/")
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
        if (this.query.length == 0 || this.showDevelopment) {
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
            decoder: new ArrayDecoder(Organization as Decoder<Organization>),
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

    async loginOrganization(organization: Organization, animated = true) {
        if (this.loadingSession) {
            return
        }
        this.loadingSession = organization.id

        if (animated == true && organization.id === "34541097-44dd-4c68-885e-de4f42abae4c") {
            await Storage.keyValue.setItem('next_url_load', '/beheerders/'+organization.uri)
            await AppManager.shared.checkUpdates({
                // Always load the staging build
                customText: 'Bezig met laden...',
                visibleDownload: true,
                installAutomatically: true,
                force: STAMHOOFD.environment !== 'staging',
                channel: 'https://files.stamhoofd.be/releases/app/staging/latest.json',
                checkTimeout: 15 * 1000
            })
            await Storage.keyValue.removeItem('next_url_load')
        }
        
        try {
            const session = await SessionManager.getPreparedContextForOrganization(organization);
            this.present({
                components: [
                    getScopedDashboardRoot(session)
                ],
                animated: true
            })
        } catch (e) {
            console.error(e)
            Toast.fromError(e).show()
        }

        this.loadingSession = null;
        await this.updateDefault()
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
    max-width: 600px;
    margin: 0 auto;
    width: 100%;

    @media (min-height: 800px) {
        padding-top: 40px;
    }

    &.native {
        padding-top: 0;
    }

    .version-box {
        padding: 15px 0;
    }

    > h1 {
        @extend .style-title-huge;
        @extend .style-text-gradient;
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

    > footer {
        padding-top: 15px;
    }

    > .search-result {
        @extend .style-input-shadow;
        background: $color-background;
        border: $border-width solid $color-border;
        padding: 15px 15px;
        padding-right: 0px;
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
        display: flex;
        flex-basis: row;
        align-items: center;
        --block-width: 40px;

        > figure {
            flex-shrink: 0;
            padding-right: 15px;
        }

        > div {
            flex-grow: 1;
            position: relative;
            padding-right: 40px;

            > h1 {
                @extend .style-title-list;
            }

            > .floating {
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translate(0, -50%);
                transition: color 0.2s;
            }

            > p {
                @extend .style-description-small;
            }
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
