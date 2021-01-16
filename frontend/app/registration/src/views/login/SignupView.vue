<template>
    <div class="boxed-view">
        <form class="signup-view st-view" @submit.prevent="submit">
            <main>
                <h1>Account aanmaken</h1>

                <STErrorsDefault :error-box="errorBox" />

                <EmailInput ref="emailInput" v-model="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />

                <STInputBox title="Kies een wachtwoord">
                    <input v-model="password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>

                <STInputBox title="Herhaal wachtwoord">
                    <input v-model="passwordRepeat" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password">
                </STInputBox>


                <Checkbox v-if="privacyUrl" v-model="acceptPrivacy" class="long-text">
                    Ik heb kennis genomen van <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
                </Checkbox>
            </main>

            <STToolbar>
                <template #right>
                    <LoadingButton :loading="loading">
                        <button class="button primary full">
                            <span class="icon lock" />
                            <span>Account aanmaken</span>
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </form>
    </div>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ConfirmEmailView,EmailInput, ErrorBox, LoadingButton, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { LoginHelper, Session, SessionManager } from '@stamhoofd/networking';
import { Component, Mixins, Ref } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';

// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STToolbar,
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

    @Ref("emailInput")
    emailInput: EmailInput

    get privacyUrl() {
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
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
        
        const component = new CenteredMessage("Account aanmaken...", "We maken gebruik van lange wiskundige berekeningen die alle gegevens sterk beveiligen door middel van end-to-end versleuteling. Dit kan even duren.", "loading").show()

        try {
            const session = new Session(OrganizationManager.organization.id)
            session.organization = OrganizationManager.organization

            const token = await LoginHelper.signUp(session, this.email, this.password)
            
            this.loading = false;
            component.hide()

            this.show(new ComponentWithProperties(ConfirmEmailView, { token, session }))
            return
            
        } catch (e) {
            console.log(e)
            this.loading = false;
            component.hide()

            if (isSimpleError(e) || isSimpleErrors(e)) {
                this.errorBox = new ErrorBox(e)
                return;
            }

            new CenteredMessage("Er ging iets mis", "Het is niet gelukt om de sleutels aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.", "error").addCloseButton().show()
            return;
        }
        
    }

    mounted() {
        setTimeout(() => {
            this.emailInput.focus()
        }, 300);
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
