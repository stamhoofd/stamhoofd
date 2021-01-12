<template>
    <div id="login-view" class="padded-view">
        <div class="split-login-view">
            <form class="login-view st-view auto" @submit.prevent="submit">
                <h1>Inloggen</h1>
                
                <main>
                    <STInputBox title="E-mailadres" class="max">
                        <input v-model="email" class="input" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" type="email" autofocus>
                    </STInputBox>

                    <STInputBox title="Wachtwoord" class="max">
                        <button slot="right" class="button text" type="button" @click="gotoPasswordForgot">
                            <span>Vergeten</span>
                            <span class="icon help" />
                        </button>
                        <input v-model="password" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password">
                    </STInputBox>
                </main>

                <STFloatingFooter>
                    <LoadingButton :loading="loading">
                        <button class="button primary full">
                            <span class="lock" />
                            Inloggen
                        </button>
                    </LoadingButton>
                    <button class="button secundary full" type="button" @click="createAccount">
                        Account aanmaken
                    </button>
                </STFloatingFooter>
            </form>

            <aside>
                <h1>Hoe schrijf je iemand in?</h1>
                <ol>
                    <li>Log in, of maak een account aan.</li>
                    <li>Vul alle gegevens van de leden in of kijk ze na.</li>
                    <li>Betaal het lidgeld.</li>
                    <li>Klaar! Je hoeft vanaf nu enkel nog de gegevens jaarlijks na te kijken.</li>
                </ol>
            </aside>
        </div>
        <p class="stamhoofd-footer">
            <a href="https://www.stamhoofd.be" target="_blank" class="button text">Ledenadministratie software door <strong>Stamhoofd</strong> voor {{ organization.name }}</a>
        </p>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,HistoryManager,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ForgotPasswordResetView, ForgotPasswordView,LoadingButton, STFloatingFooter, STInputBox, STNavigationBar } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import { LoginHelper,NetworkManager, SessionManager } from '@stamhoofd/networking';
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import SignupView from './SignupView.vue';

const throttle = (func, limit) => {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
};

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STFloatingFooter,
        STInputBox,
        LoadingButton
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""

    session = SessionManager.currentSession!

    mounted() {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 1 && parts[0] == 'reset-password') {
            // tood: password reset view
            this.present(new ComponentWithProperties(ForgotPasswordResetView, {}).setDisplayStyle("popup"));
        }
    }

     get organization() {
        return OrganizationManager.organization
    }

    gotoPasswordForgot() {
        this.present(new ComponentWithProperties(ForgotPasswordView, {}).setDisplayStyle("sheet"))
    }

    createAccount() {
        this.show(new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(SignupView, {})
        }).setDisplayStyle("sheet")) 
    }

    async submit() {
        if (this.loading) {
            return
        }

        if (this.email.length < 3 || this.password.length < 5) {
            new CenteredMessage("Vul eerst iets in", "Je hebt geen correcte gegevens ingevuld", "error").addCloseButton().show()   
            return
        }

        this.loading = true
        
        // Request the key constants
        const component = new CenteredMessage("Inloggen...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even.", "loading").show()
        try {
            await LoginHelper.login(this.session, this.email, this.password)
        } catch (e) {
            console.error(e)
            this.loading = false;

            new CenteredMessage("Inloggen mislukt", e.human ?? e.message ?? "Er ging iets mis", "error").addCloseButton().show()           
            return;
        } finally {
            component.hide()
        }
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

    #login-view {
        .stamhoofd-footer {
            max-width: 850px;
            margin: 0 auto;
            @extend .style-description;
            padding: 15px;
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
        padding-top: 100px;
        max-width: 850px;
        margin: 0 auto;
        display: grid;
        width: 100%;
        grid-template-columns: minmax(300px, 380px) auto;
        gap: 60px;
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
            @extend .style-text-large;
            padding-left: 30px;

            li {
                counter-increment: li;
                padding: 8px 0;
            }

            li::before {
                content: counter(li)"."; 
                @extend .style-title-2;
                color: $color-primary;
                display: inline-block; 
                width: 30px;
                margin-left: -30px;;
            }
        }

        aside > h1 {
            @extend .style-title-1;
            padding-bottom: 30px;;
        }
    }

    .login-view {
        @media (min-width: 801px) {
            @include style-side-view-shadow();
            background: $color-white;
            border-radius: $border-radius;
        }

        > h1 {
            @extend .style-huge-title-1;
            padding-bottom: 20px;
        }

        > p {
            @extend .style-description;
            padding-bottom: 10px;
        }

        > input.search {
            max-width: none;
        }

        > .spinner-container {
            padding: 10px 0;
        }

        > .search-result {
            @extend .style-input-shadow;
            background: $color-white url('~@stamhoofd/assets/images/icons/gray/arrow-right-small.svg') right 10px center no-repeat;
            border: $border-width solid $color-gray-light;
            padding: 20px 20px;
            border-radius: $border-radius;
            margin: 10px 0;
            transition: transform 0.2s, border-color 0.2s;
            cursor: pointer;
            touch-action: manipulation;
            user-select: none;
            display: block;
            width: 100%;
            text-align: left;

            > h1 {
                @extend .style-title-3;
                padding-bottom: 2px;
            }

            > p {
                @extend .style-description;
            }

            &:hover {
                border-color: $color-primary-gray-light;
            }


            &:active {
                transform: scale(0.95, 0.95);
                border-color: $color-primary;
            }
        }
    }
</style>
