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
                <button v-if="organization.website" class="button text limit-space" type="button" @click="returnToSite">
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
                            <h1>Ledenportaal</h1>
                            <p>Log in om jouw gegevens te wijzigen, documenten te raadplegen of in te schrijven.</p>
                            
                            <div class="button-box">
                                <button class="button primary full" type="button" @click="login()">
                                    <span class="icon lock" />
                                    <span>Inloggen</span>
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
                                <li>Schrijf leden in en vul gegevens aan.</li>
                                <li>Betalen.</li>
                                <li>Klaar!</li>
                            </ol>
                        </aside>
                    </div>
                    <p class="stamhoofd-footer">
                        <a :href="'https://'+$t('shared.domains.marketing')+'/ledenadministratie'" target="_blank" class="button text"><span>Ledenadministratie via</span> <strong class="notranslate">Stamhoofd</strong></a>
                    </p>
                </main>
            </div>

            <div class="view gray-shadow">
                <main>
                    <GroupTree :category="rootCategory" />
                </main>
            </div>

            <LegalFooter :organization="organization" class="shade" />
        </main>
    </div>
</template>

<script lang="ts">
import { ComponentWithProperties, NavigationController, NavigationMixin, PushOptions } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, CenteredMessageView, ForgotPasswordResetView, ForgotPasswordView, LegalFooter,LoadingButton, ModalStackEventBus, OrganizationLogo, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
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
        GroupTree,
        LegalFooter
    },
    metaInfo() {
        return {
            title: "Inschrijven bij "+OrganizationManager.organization.name,
            meta: [
                {
                    vmid: 'description',
                    name: 'description',
                    content: "Via deze website kan je jouw inschrijvingen beheren.",
                },
                {
                    hid: 'og:site_name',
                    name: 'og:site_name',
                    content: OrganizationManager.organization.name,
                },
                {
                    hid: 'og:title',
                    name: 'og:title',
                    content: "Inschrijven bij "+OrganizationManager.organization.name,
                },
                ...(this.firstImageResolution ? [
                    {
                        hid: 'og:image',
                        name: 'og:image',
                        content: this.firstImageResolution.file.getPublicPath()
                    },
                    {
                        hid: 'og:image:width',
                        name: 'og:image:width',
                        content: this.firstImageResolution.width
                    },
                    {
                        hid: 'og:image:height',
                        name: 'og:image:height',
                        content: this.firstImageResolution.height
                    },
                    {
                        hid: 'og:image:type',
                        name: 'og:image:type',
                        content: this.firstImageResolution.file.getPublicPath().endsWith(".png") ? 'image/png' : 'image/jpeg'
                    },
                ] : [])
            ]
        }
    }
})
export default class HomeView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""

    session = SessionManager.currentSession!

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        const queryString =  UrlHelper.shared.getSearchParams()

        UrlHelper.setUrl("/")

        if (parts.length == 1 && parts[0] == 'reset-password') {
            UrlHelper.shared.clear()

            const token = queryString.get('token');
            this.present(new ComponentWithProperties(ForgotPasswordResetView, { token }).setDisplayStyle("popup"));
        }

        if (parts.length == 1 && parts[0] == 'login') {
            UrlHelper.shared.clear()

            const email = queryString.get('email')
            const hasAccount = queryString.get('hasAccount')

            if (email) {
                if (hasAccount === null || hasAccount === "1") {
                    this.login(false, email, "Dit adres is verbonden met jouw gegevens. Je kan jouw e-mailadres na het inloggen wijzigen. Gebruik de wachtwoord vergeten knop als je jouw wachtwoord niet meer weet.")
                } else {
                    this.createAccount(false, email, "Je kan jouw e-mailadres pas wijzigen nadat je een account hebt aangemaakt.")
                }
            }
        }

        ModalStackEventBus.addListener(this, "present", async (options: PushOptions | ComponentWithProperties) => {
            this.present(options);
            return Promise.resolve()
        })

        CenteredMessage.addListener(this, (centeredMessage) => {
            this.present(new ComponentWithProperties(CenteredMessageView, { centeredMessage }).setDisplayStyle("overlay"))
        })
    }

    get firstImage() {
        for (const group of this.organization.groups) {
            if (group.settings.coverPhoto) {
                return group.settings.coverPhoto
            }
        }
        return null
    }

    get firstImageResolution() {
        return this.firstImage?.getResolutionForSize(2000, 2000)
    }

    beforeDestroy() {
        CenteredMessage.removeListener(this)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get rootCategory() {
        return this.organization.publicCategoryTree
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
            margin-left: 5px;
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
