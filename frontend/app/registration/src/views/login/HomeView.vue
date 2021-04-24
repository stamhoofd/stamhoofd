<template>
    <div id="home-view" class="st-view">
        <STNavigationBar :large="true">
            <template slot="left">
                <OrganizationLogo :organization="organization" />
            </template>

            <template slot="right">
                <a v-if="privacyUrl" class="button text limit-space" :href="privacyUrl" target="_blank">
                    <span class="icon privacy" />
                    <span>Privacy</span>
                </a>
                <button v-if="organization.website" class="button text limit-space" @click="returnToSite">
                    <span class="icon external" />
                    <span>Terug naar website</span>
                </button>
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <div class="white-top view">
                <main>
                    <div class="split-login-view">
                        <div class="container login-view">
                            <h1>Begin met inschrijven</h1>
                            <p>Onderaan deze pagina vind je meer informatie over waar je zoal voor kan inschrijven.</p>
                            
                            <div class="button-box">
                                <button class="button primary full" @click="login()">
                                    <span class="lock" />
                                    Inloggen
                                </button>
                                <button class="button secundary full" type="button" @click="createAccount()">
                                    Account aanmaken
                                </button>
                            </div>
                        </div>

                        <aside>
                            <h1>Hoe schrijf je iemand in?</h1>
                            <ol>
                                <li>Log in, of maak een account aan.</li>
                                <li>Vul alle gegevens van de leden in of kijk ze na.</li>
                                <li>Betaal het lidgeld.</li>
                                <li>Klaar! De volgende keer moet je enkel de gegevens nakijken.</li>
                            </ol>
                        </aside>
                    </div>
                    <p class="stamhoofd-footer">
                        <a href="https://www.stamhoofd.be" target="_blank" class="button text">Ledenadministratie door <strong>Stamhoofd</strong></a>
                    </p>
                </main>
            </div>

            <div class="view gray-shadow">
                <main>
                    <GroupTree :category="rootCategory" />
                </main>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ForgotPasswordResetView, ForgotPasswordView,LoadingButton, OrganizationLogo,STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { SessionManager } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import GroupTree from '../../components/GroupTree.vue';
import LoginView from './LoginView.vue';
import SignupView from './SignupView.vue';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton,
        OrganizationLogo,
        GroupTree
    }
})
export default class HomeView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""

    session = SessionManager.currentSession!

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");
        let clearPath = true

        if (parts.length == 1 && parts[0] == 'reset-password') {
            // tood: password reset view
            this.present(new ComponentWithProperties(ForgotPasswordResetView, {}).setDisplayStyle("popup"));
            clearPath = false
        }

        if (parts.length == 1 && parts[0] == 'login') {
            clearPath = false

            const queryString = new URL(window.location.href).searchParams;
            const email = queryString.get('email')
            const hasAccount = queryString.get('hasAccount')

            if (email) {
                if (hasAccount === null || hasAccount === "1") {
                    this.login(false, email, "Je moet op dit account inloggen om jouw gegevens te kunnen wijzigen. Maak zeker geen nieuw aan.")
                } else {
                    this.createAccount(false, email, "Je kan jouw e-mailadres pas wijzigen nadat je een account hebt aangemaakt.")
                }
            }
        }

        if (clearPath) {
            HistoryManager.setUrl("/")
        }

        CenteredMessage.addListener(this, (centeredMessage) => {
            this.present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })
    }

    beforeDestroy() {
        CenteredMessage.removeListener(this)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get rootCategory() {
        return this.organization.categoryTree.filterForDisplay(false, this.organization.meta.packages.useActivities)
    }

    get privacyUrl() {
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    returnToSite() {
        if (!this.organization.website || (!this.organization.website.startsWith("https://") && !this.organization.website.startsWith("http://"))) {
            return
        }
        window.location.href = this.organization.website
    }

    gotoPasswordForgot() {
        this.present(new ComponentWithProperties(ForgotPasswordView, {}).setDisplayStyle("sheet"))
    }

    login(animated = true, email = "", lock: null | string) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(LoginView, {
                initialEmail: email,
                lock
            })
        }).setAnimated(animated).setDisplayStyle("sheet")) 
    }

    createAccount(animated = true, email = "", lock: null | string) {
        this.present(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(SignupView, {
                initialEmail: email,
                lock
            })
        }).setAnimated(animated).setDisplayStyle("popup")) 
    }
}
</script>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use "~@stamhoofd/scss/base/text-styles.scss" as *;

#home-view {
    .stamhoofd-footer {
        @extend .style-description;
        padding: 15px 0;
        padding-top: 30px;

        a {
            white-space: normal;
            text-overflow: initial;
            height: auto;
            line-height: 1.4;
        }

        strong {
            color: $color-primary-original;
        }
    }
}

.split-login-view {
    padding-top: 40px;
    display: grid;
    width: 100%;
    grid-template-columns: minmax(300px, 350px) auto;
    gap: 100px;
    align-items: center;

    @media (max-width: 800px) {
        padding-top: 0;
        display: block;

        > aside {
            padding: 0 var(--st-horizontal-padding, 20px);
            padding-top: 20px;
        }
    }

    ol {
        list-style: none; 
        counter-reset: li;
        @extend .style-normal;
        padding-left: 30px;

        li {
            counter-increment: li;
            padding: 8px 0;
        }

        li::before {
            content: counter(li)"."; 
            @extend .style-normal;
            color: $color-primary;
            display: inline-block; 
            width: 30px;
            margin-left: -30px;;
        }
    }

    aside > h1 {
        @extend .style-title-2;
        padding-bottom: 20px;;
    }
}

.login-view {
    > h1 {
        @extend .style-title-1;
        padding-bottom: 20px;
    }

    > p {
        @extend .style-description;
        padding-bottom: 10px;
    }

    > .button-box {
        padding-top: 20px;
        display: flex;
        flex-direction: column;
        justify-content: stretch;

        > * {
            margin-top: 10px;;
        }
    }
}
</style>
