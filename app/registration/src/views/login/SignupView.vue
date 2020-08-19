<template>
    <form class="signup-view st-view" @submit.prevent="submit">
        <STNavigationBar title="Account aanmaken">
            <button slot="right" class="button icon gray close" @click="pop" type="button"></button>
        </STNavigationBar>
        <main>
            <h1>Account aanmaken</h1>

            <p>Al jouw gegevens worden in een versleutelde digitale kluis bijgehouden - ook het computerssysteem heeft hier geen toegang tot. Het is belangrijk dat je de toegang tot die kluis goed beschermd met sterke wachtwoorden.</p>

            <STErrorsDefault :error-box="errorBox" />

            <div class="split-inputs">
                <div>
                    <EmailInput title="E-mailadres" v-model="email" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username"/>

                    <STInputBox title="Kies een wachtwoord">
                        <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                    </STInputBox>

                    <Checkbox v-model="acceptPrivacy" class="long-text" v-if="privacyUrl">
                        Ik heb kennis genomen van <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
                    </Checkbox>
                </div>
                <div>
                    <div class="warning-box">Gebruik bij voorkeur een wachtwoordbeheerder of kies een sterk wachtwoord dat je kan onthouden.</div>
                </div>
            </div>
        </main>

        <STFloatingFooter>
            <LoadingButton :loading="loading">
                <button class="button primary full">
                    <span class="icon lock" />
                    <span>Account aanmaken</span>
                </button>
            </LoadingButton>
        </STFloatingFooter>
    </form>
</template>

<script lang="ts">
import { ArrayDecoder, Decoder, ObjectData } from '@simonbackx/simple-encoding';
import { ComponentWithProperties,NavigationController,NavigationMixin } from "@simonbackx/vue-app-navigation";
import { NetworkManager, SessionManager, Session, LoginHelper } from '@stamhoofd/networking';
import { Component, Mixins } from "vue-property-decorator";
import { ChallengeResponseStruct,KeyConstants,NewUser, OrganizationSimple, Token, User, Version } from '@stamhoofd/structures';
import { CenteredMessage, LoadingButton, STFloatingFooter, STInputBox, STNavigationBar, STErrorsDefault, ErrorBox, EmailInput, Validator, Checkbox } from "@stamhoofd/components"
import { Sodium } from '@stamhoofd/crypto';
import ForgotPasswordView from './ForgotPasswordView.vue';
import { OrganizationManager } from '../../classes/OrganizationManager';
import { SimpleError } from '@simonbackx/simple-errors';

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
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        Checkbox
    }
})
export default class SignupView extends Mixins(NavigationMixin){
    loading = false;
    email = ""
    password = ""
    passwordRepeat = ""
    acceptPrivacy = false

    errorBox: ErrorBox | null = null
    validator = new Validator()

    session = SessionManager.currentSession!

    get privacyUrl() {
        if (OrganizationManager.organization!.meta.privacyPolicyUrl) {
            return OrganizationManager.organization!.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization!.meta.privacyPolicyFile) {
            return OrganizationManager.organization!.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    async submit() {
        if (this.loading) {
            return
        }

        const valid = await this.validator.validate()

        if (this.password != this.passwordRepeat) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "De ingevoerde wachtwoorden komen niet overeen"
            }))
            return;
        }

        if (this.password.length < 8) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Jouw wachtwoord moet uit minstens 8 karakters bestaan."
            }))
            return;
        }

        if (!this.acceptPrivacy && !!this.privacyUrl) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "read_privacy",
                message: "Je moet kennis hebben genomen van het privacybeleid voor je een account kan aanmaken."
            }))
            return;
        }

        if (!valid) {
            this.errorBox = null
            return;
        }

        this.loading = true
        // Request the key constants
        
        const component = new ComponentWithProperties(CenteredMessage, { 
            type: "loading",
            title: "Account aanmaken...", 
            description: "We maken gebruik van lange wiskundige berekeningen die jouw gegevens sterk beveiligen door middel van end-to-end encryptie. Dit duurt maar heel even."
        }).setDisplayStyle("overlay");
        this.present(component)

        try {
            const session = new Session(OrganizationManager.organization.id)
            session.organization = OrganizationManager.organization

            await LoginHelper.signUp(session, this.email, this.password)
            
            this.loading = false;
            (component.componentInstance() as any)?.pop()
            this.dismiss({ force: true })
            
        } catch (e) {
            this.loading = false;
            (component.componentInstance() as any)?.pop()

            const errorMessage = new ComponentWithProperties(CenteredMessage, { 
                type: "error",
                title: "Er ging iets mis", 
                description: "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.",
                closeButton: "Sluiten",
            }).setDisplayStyle("overlay");
            this.present(errorMessage)
            return;
        }
        
    }
}
</script>

<style lang="scss">
    @use "~@stamhoofd/scss/base/variables.scss" as *;
    @use "~@stamhoofd/scss/base/text-styles.scss" as *;

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
        @media (min-width: 800px + 50px*2 - 1px) {
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
