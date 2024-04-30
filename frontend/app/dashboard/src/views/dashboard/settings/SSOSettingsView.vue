<template>
    <SaveView :loading="saving" title="SSO" :disabled="!hasChanges" @save="save">
        <h1>
            Single-Sign-On
        </h1>
        <p>
            Zorg dat gebruikers kunnen inloggen via je eigen accountsysteem, apart van Stamhoofd. Momenteel kan dit enkel gebruikt worden voor webshops. Voor Microsoft kan je <a href="https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app" target="_blank" class="inline-link">deze</a> handleiding volgen.
        </p>

        <STErrorsDefault :error-box="errorBox" />

        <STInputBox title="Issuer" error-fields="issuer" :error-box="errorBox">
            <input
                ref="firstInput"
                v-model="issuer"
                class="input"
                type="text"
                placeholder="bv. https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0"
                autocomplete=""
                :disabled="loading"
            >
        </STInputBox>

        <STInputBox title="Client ID" error-fields="clientId" :error-box="errorBox">
            <input
                v-model="clientId"
                class="input"
                type="text"
                placeholder="bv. 12345678-1234-1234-1234-123456789012"
                autocomplete=""
                :disabled="loading"
            >
        </STInputBox>

        <STInputBox title="Client Secret" error-fields="clientSecret" :error-box="errorBox">
            <input
                v-model="clientSecret"
                class="input"
                type="text"
                placeholder="bv. 12345678-1234-1234-1234-123456789012"
                autocomplete=""
                :disabled="loading"
            >
        </STInputBox>

        <STInputBox title="Redirect URI" :error-box="errorBox">
            <input
                :value="redirectUri"
                class="input"
                type="text"
                autocomplete=""
                readonly
            >
        </STInputBox>
    </SaveView>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { Request } from "@simonbackx/simple-networking";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, ErrorBox, SaveView, STErrorsDefault, STInputBox, Validator } from "@stamhoofd/components";
import { SessionManager, UrlHelper } from '@stamhoofd/networking';
import { OpenIDClientConfiguration } from "@stamhoofd/structures";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";



@Component({
    components: {
        SaveView,
        STInputBox,
        STErrorsDefault
    },
})
export default class SSOSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    ssoConfiguration: OpenIDClientConfiguration | null = null

    get organization() {
        return this.$organization
    }

    get redirectUri() {
        return 'https://' + this.organization.id + "." + STAMHOOFD.domains.api + '/openid/callback'
    }

    get hasChanges() {
        return true;
    }

    get issuer() {
        return this.ssoConfiguration?.issuer ?? ""
    }

    set issuer(value: string) {
        if (this.ssoConfiguration) {
            this.ssoConfiguration.issuer = value
        }
    }

    get clientId() {
        return this.ssoConfiguration?.clientId ?? ""
    }

    set clientId(value: string) {
        if (this.ssoConfiguration) {
            this.ssoConfiguration.clientId = value
        }
    }

    get clientSecret() {
        return this.ssoConfiguration?.clientSecret ?? ""
    }

    set clientSecret(value: string) {
        if (this.ssoConfiguration) {
            this.ssoConfiguration.clientSecret = value
        }
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    async loadConfiguration() {
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "GET",
                path: "/organization/sso",
                decoder: OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
                owner: this
            })
            this.ssoConfiguration = response.data
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
    }

    async save() {
        if (this.saving) {
            return
        }
        this.saving = true
        try {
            const response = await this.$context.authenticatedServer.request({
                method: "POST",
                path: "/organization/sso",
                decoder: OpenIDClientConfiguration as Decoder<OpenIDClientConfiguration>,
                body: this.ssoConfiguration,
                owner: this,
                shouldRetry: false
            })
            this.ssoConfiguration = response.data
            this.dismiss({force: true})
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }
        this.saving = false
    }

    beforeUnmount() {
        Request.cancelAll(this)
    }

    mounted() {
        UrlHelper.setUrl("/settings/sso");
        this.loadConfiguration().catch(console.error)
    }
}
</script>
