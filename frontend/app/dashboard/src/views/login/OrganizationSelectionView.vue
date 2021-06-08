<template>
    <div class="st-view shade">
        <STNavigationBar :large="true" :sticky="true">
            <template slot="left">
                <a alt="Stamhoofd" href="https://www.stamhoofd.be" rel="noopener">
                    <Logo class="responsive" />
                </a>
            </template>

            <template slot="right">
                <a class="button primary" href="/aansluiten" @click.prevent="gotoSignup">
                    Aansluiten
                </a>
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <div class="organization-selection-view">
                <a class="button text" href="https://www.stamhoofd.be" rel="noopener">
                    <span class="icon arrow-left" />
                    <span>Stamhoofd website</span>
                </a>
                <h1>Kies jouw vereniging</h1>
                <p>Selecteer de vereniging waar je wilt inloggen of gebruik de knop bovenaan om een nieuwe vereniging aan te sluiten.</p>
                <input v-model="query" class="input search" placeholder="Zoek op postcode of naam" @input="query = $event.target.value">

                <Spinner v-if="loading" class="gray center" />
                <template v-else>
                    <button v-for="organization in filteredResults" :key="organization.id" class="search-result" @click="loginOrganization(organization)">
                        <h1>{{ organization.name }}</h1>
                        <p>{{ organization.address }}</p>
                        <Spinner v-if="loadingSession === organization.id" class="floating" />
                        <span v-else-if="isSignedInFor(organization)" class="icon success floating" />
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

                <a href="/aansluiten" class="button text full" @click.prevent="gotoSignup">
                    <span class="icon add" />
                    <span>Nieuwe vereniging aansluiten</span>
                </a>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Logo, Spinner, STNavigationBar, Toast } from '@stamhoofd/components';
import { NetworkManager,SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationSimple } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { asyncComponent } from '../../App.vue';
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
            ],
            link: [
                { rel: "canonical", href: "https://"+window.location.hostname }
            ]
        }
    }
})
export default class OrganizationSelectionView extends Mixins(NavigationMixin){
    loading = false;
    loadingSession: string | null = null;
    q = ""
    results: OrganizationSimple[] = []

    get query() {
        return this.q
    }

    set query(query: string) {
        this.q = query

        // update
        this.startUpdateResults();
    }

    help() {
        new CenteredMessage("Vereniging niet gevonden", "In dit overzicht staan enkel verenigingen die al aangesloten zijn bij Stamhoofd. Je kan zelf een nieuwe vereniging aansluiten via de knop 'Aansluiten' bovenaan.").addCloseButton("Sluiten").show()
    }

    gotoSignup() {
        this.present(
            new ComponentWithProperties(NavigationController, {
                root: asyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ '../signup/SignupGeneralView.vue'), {})
            }).setDisplayStyle("popup")
        )
        plausible('openSignup');
    }

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        const queryString = new URL(window.location.href).searchParams;

        console.log('reset url path org selection view')
        HistoryManager.setUrl("/")

        if (parts.length >= 1 && parts[0] == 'aansluiten') {
            try {
                const currentCount = localStorage.getItem("what-is-new")

                let code = queryString.get("code")
                let organization = queryString.get("org")

                if (currentCount !== null && (code || organization)) {
                    console.warn("Already has an organization. Skip referral discount.")
                    code = null;
                    organization = null;
                }
                this.present(new ComponentWithProperties(NavigationController, {
                    root: asyncComponent(() => import(/* webpackChunkName: "SignupGeneralView" */ '../signup/SignupGeneralView.vue'), { 
                        initialRegisterCode: code && organization ? {
                            code,
                            organization
                        } : null
                    })
                }).setDisplayStyle("popup").setAnimated(false))
                
            } catch (e) {
                console.error(e)
            }
        }

        this.updateDefault()
    }

    activated() {
        console.log('reset url path org selection view')
        HistoryManager.setUrl("/")
    }

    throttleUpdateResults = throttle(this.updateResults.bind(this), 1000);

    defaultOrganizations: Organization[] = []

    updateDefault() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.defaultOrganizations = SessionManager.availableSessions().filter(s => !!s.organization).map(s => s.organization!)
    }

    get filteredResults() {
        if (this.query.length == 0) {
            return this.defaultOrganizations
        }
        return this.results
    }

    startUpdateResults() {
        this.loading = true
        this.throttleUpdateResults()
    }

    updateResults() {
        if (this.query.length == 0) {
            this.results = []
            this.loading = false
            return
        }
        this.loading = true
        NetworkManager.server.request({
            method: "GET",
            path: "/organizations/search",
            query: {query: this.query },
            decoder: new ArrayDecoder(OrganizationSimple as Decoder<OrganizationSimple>)
        }).then((response) => {
            this.results = response.data
        }).catch(e => {
            console.error(e)
            this.results = []
        }).finally(() => {
            this.loading = false
        })
    }

    loginOrganization(organization: OrganizationSimple) {
        if (this.loadingSession) {
            return
        }
        const session = SessionManager.getSessionForOrganization(organization.id)
        if (session && session.canGetCompleted()) {
            this.loadingSession = organization.id
            SessionManager.setCurrentSession(session).then(() => {
                this.loadingSession = null
                this.updateDefault()
                if (!session.canGetCompleted() && !session.isComplete()) {
                    this.loginOrganization(organization)
                }
            }).catch(e => {
                this.loadingSession = null
                this.updateDefault()
                Toast.fromError(e).show()
                console.error(e)
            })
            return
        }
        this.present(new ComponentWithProperties(NavigationController, { root: new ComponentWithProperties(LoginView, { organization }) }).setDisplayStyle("sheet"))
    }

    isSignedInFor(organization: OrganizationSimple) {
        const session = SessionManager.getSessionForOrganization(organization.id)
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

        @media (min-height: 800px) {
            padding-top: 40px;
        }

        > h1 {
            @extend .style-title-1;
            padding-bottom: 10px;
        }

        > p:not([class]) {
            @extend .style-description;
            padding-bottom: 20px;
        }

        > input.search {
            max-width: none;
        }

        > .spinner-container {
            padding: 10px 0;
        }

        > .search-result {
            @extend .style-input-shadow;
            background: $color-white;
            border: $border-width solid $color-gray-light;
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
                color: $color-gray;
                transition: color 0.2s;
            }

            > p {
                @extend .style-description-small;
            }

            &:hover {
                border-color: $color-primary-gray-light;
                background-color: $color-primary-background;

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
