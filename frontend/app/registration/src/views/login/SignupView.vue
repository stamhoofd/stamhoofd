<template>
    <form class="signup-view st-view" @submit.prevent="submit">
        <STNavigationBar title="Inloggen" />

        <main>
            <h1>Account aanmaken</h1>

            <STErrorsDefault :error-box="errorBox" />

            <EmailInput ref="emailInput" v-model="email" title="E-mailadres" name="username" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" :disabled="lock !== null" />
            <p v-if="lock" class="style-description-small">
                {{ lock }}
            </p>

            <div class="split-inputs">
                <div>
                    <STInputBox title="Kies een wachtwoord">
                        <input v-model="password" name="new-password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                    </STInputBox>

                    <STInputBox title="Herhaal wachtwoord">
                        <input v-model="passwordRepeat" name="repeat-new-password" class="input" placeholder="Kies een nieuw wachtwoord" autocomplete="new-password" type="password" @input="passwordRepeat = $event.target.value" @change="passwordRepeat = $event.target.value">
                    </STInputBox>
                </div>
                <div>
                    <PasswordStrength v-model="password" />
                </div>
            </div>

            <Checkbox v-if="privacyUrl" v-model="acceptPrivacy" class="long-text">
                Ik heb kennis genomen van <a class="inline-link" :href="privacyUrl" target="_blank">het privacybeleid</a>.
            </Checkbox>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary full" type="submit">
                        <span class="icon lock" />
                        <span>Account aanmaken</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </form>
</template>

<script lang="ts">
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox,ConfirmEmailView,EmailInput, ErrorBox, LoadingButton, PasswordStrength,STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Validator } from "@stamhoofd/components"
import { LoginHelper, Session } from '@stamhoofd/networking';
import { Component, Mixins, Prop, Ref } from "@simonbackx/vue-app-navigation/classes";



// The header component detects if the user scrolled past the header position and adds a background gradient in an animation
@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        EmailInput,
        Checkbox,
        PasswordStrength
    }
})
export default class SignupView extends Mixins(NavigationMixin){
    loading = false;
    
    @Prop({ default: ""})
        initialEmail!: string

    @Prop({ default: null})
        lock!: string | null

    email = this.initialEmail
    password = ""
    passwordRepeat = ""
    acceptPrivacy = false

    errorBox: ErrorBox | null = null
    validator = new Validator()

    @Ref("emailInput")
        emailInput: EmailInput

    get privacyUrl() {
        if (this.$organization.meta.privacyPolicyUrl) {
            return this.$organization.meta.privacyPolicyUrl
        }
        if (this.$organization.meta.privacyPolicyFile) {
            return this.$organization.meta.privacyPolicyFile.getPublicPath()
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
        this.errorBox = null
        
        // Request the key constants
        try {
            const token = await LoginHelper.signUp(this.$context, this.email, this.password)
            this.loading = false;
            this.show(new ComponentWithProperties(ConfirmEmailView, { token, email: this.email }))
            return
            
        } catch (e) {
            console.log(e)
            this.loading = false;

            if (isSimpleError(e) || isSimpleErrors(e)) {
                this.errorBox = new ErrorBox(e)
                return;
            }

            new CenteredMessage("Er ging iets mis", "Het is niet gelukt om een account aan te maken. Probeer het op een ander toestel of browser opnieuw uit of neem contact met ons op.", "error").addCloseButton().show()
            return;
        }
        
    }

    mounted() {
        setTimeout(() => {
            // Needed the any here because typescript is getting mad only in production mode
            if (this.emailInput) {
                (this.emailInput as any).focus()
            }
        }, 300);
    }
}
</script>