<template>
    <div class="st-view shade login-view">
        <STNavigationBar :large="true">
            <template #left>
                <a alt="Stamhoofd" href="https://www.stamhoofd.be" rel="noopener" class="logo-container">
                    <Logo class="responsive" />
                    <span class="logo-text horizontal">Admin</span>
                </a>
            </template>
        </STNavigationBar>
        <main class="limit-width">
            <div class="centered-view"> 
                <form autocomplete="off" data-submit-last-field @submit.prevent="login">
                    <h1>Inloggen</h1>
                    <p>Deze website is enkel toegankelijk voor administrators.</p>

                    <STErrorsDefault :error-box="errorBox" />

                    <EmailInput ref="emailInput" v-model="email" enterkeyhint="next" class="max" name="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />

                    <STInputBox title="Wachtwoord" class="max">
                        <input v-model="password" enterkeyhint="go" class="input" placeholder="Vul jouw wachtwoord hier in" autocomplete="current-password" type="password" @input="password = $event.target.value" @change="password = $event.target.value">
                    </STInputBox>

                    <LoadingButton :loading="loading" class="block bottom">
                        <button class="button primary full" type="submit">
                            Inloggen
                        </button>
                    </LoadingButton>
                </form>

                <button class="button text" type="button" @click="register">
                    <span class="help icon" />
                    <span>Ik heb geen account</span>
                </button>
            </div>
        </main>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { EmailInput,ErrorBox, LoadingButton, Logo, Spinner, STErrorsDefault, STFloatingFooter, STInputBox, STNavigationBar } from '@stamhoofd/components';
import { UrlHelper } from '@stamhoofd/networking';
import { Token } from "@stamhoofd/structures";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from "../classes/AdminSession";
import SignupView from "./SignUpView.vue";


@Component({
    components: {
        Spinner,
        STNavigationBar,
        STInputBox,
        LoadingButton,
        STErrorsDefault,
        STFloatingFooter,
        EmailInput,
        Logo
    }
})
export default class LoginView extends Mixins(NavigationMixin){
    email = ""
    password = ""
    errorBox: ErrorBox | null = null
    loading = false

    get isDevelopment() {
        return STAMHOOFD.environment === "development"
    }

    mounted() {
        const parts =  UrlHelper.shared.getParts()
        UrlHelper.setUrl("/")

        if (parts.length == 1 && parts[0] == 'register') {
            // Show register view
            this.present(new ComponentWithProperties(SignupView).setDisplayStyle("popup").setAnimated(false))
        }
    }
    
    register() {
        this.present(new ComponentWithProperties(SignupView).setDisplayStyle("popup"))
    }

    async login() {
        if (this.loading || this.password.length == 0 || this.email.length == 0) {
            return
        }
        this.loading = true

        try {
            const response = await AdminSession.shared.server.request({
                method: "POST",
                path: "/oauth/token",
                body: {
                    grant_type: "password",
                    password: this.password,
                    username: this.email
                },
                decoder: Token as Decoder<Token>
            })
            AdminSession.shared.setToken(response.data)
            await AdminSession.shared.updateData()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
        }
        this.loading = false
        
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.login-view .centered-view {
    max-width: 350px;
    margin: 0 auto;

    @media (max-height: 800px) {
        padding-top: 40px;
    }
    @media (max-height: 600px) {
        padding-top: 20px;
    }

    form {
        > h1 {
            @extend .style-title-1;
            padding-bottom: 10px;
        }

        > p {
            @extend .style-description;
            padding-bottom: 20px;
        }
    }
}
</style>
