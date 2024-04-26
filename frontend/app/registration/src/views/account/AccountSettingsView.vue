<template>
    <div id="account-view" class="st-view">
        <STNavigationBar :pop="canPop" :dismiss="canDismiss" title="Mijn account" />

        <main>
            <h1>
                Mijn account
            </h1>
            <p>Met een account kan je één of meerdere leden beheren.</p>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Mijn naam" error-fields="firstName,lastName" :error-box="errorBox">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                    </div>
                </div>
            </STInputBox>

            <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="email" />

            <hr>

            <p>
                <button class="button text" type="button" @click.prevent="openChangePassword">
                    <span class="icon key" />
                    <span>Wachtwoord wijzigen</span>
                </button>
            </p>

            <p>
                <a v-if="privacyUrl" class="button text" type="button" :href="privacyUrl" target="_blank">
                    <span class="icon privacy" />
                    <span>Privacyvoorwaarden</span>
                </a>
            </p>

            <p>
                <button class="button text" type="button" @click.prevent="logout">
                    <span class="icon logout" />
                    <span>Uitloggen</span>
                </button>
            </p>
        </main>
        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, ChangePasswordView, Checkbox, ConfirmEmailView, DateSelection, EmailInput, ErrorBox, LoadingButton, RadioGroup, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { LoginHelper, SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationPatch, User, Version } from "@stamhoofd/structures";
import { Component, Mixins } from "vue-property-decorator";


import PaymentsView from "./PaymentsView.vue";


@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        DateSelection,
        RadioGroup,
        BackButton,
        LoadingButton,
        EmailInput,
        PaymentsView
    },
})
export default class AccountSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    showDomainSettings = true

    // Needed to make the current session (and user reactive)
    session = this.$context
    
    get user() {
        console.log("user updated!")
        return User.create(this.$user!)
    }

    userPatch = User.patch({ id: this.user.id })
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: this.$organization.id })

    get patchedUser() {
        return this.user.patch(this.userPatch)
    }

    get email() {
        return this.patchedUser.email
    }

    set email(email: string) {
        this.$set(this.userPatch, "email", email)
    }

    get isAdmin() {
        return this.user.permissions !== null
    }

    get firstName() {
        return this.patchedUser.firstName
    }

    set firstName(firstName: string | null) {
        this.$set(this.userPatch, "firstName", firstName)
    }

    get lastName() {
        return this.patchedUser.lastName
    }

    set lastName(lastName: string | null) {
        this.$set(this.userPatch, "lastName", lastName)
    }

    get privacyUrl() {
        if (this.$organization.meta.privacyPolicyUrl) {
            return this.$organization.meta.privacyPolicyUrl
        }
        if (this.$organization.meta.privacyPolicyFile) {
            return this.$organization.meta.privacyPolicyFile.getPublicPath()
        }
        return null
    }

    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
        // validations here

        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            const result = await LoginHelper.patchUser(this.$context, this.userPatch)

            if (result.verificationToken) {
                this.present(new ComponentWithProperties(ConfirmEmailView, { token: result.verificationToken, email: this.patchedUser.email }).setDisplayStyle("sheet"))
            } else {
                const toast = new Toast('De wijzigingen zijn opgeslagen', "success green")
                toast.show()
            }

            // Create a new patch
            this.userPatch = User.patch({ id: this.user.id })
            this.dismiss({force: true});
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.userPatch, this.user, { version: Version })) {
            return true;
        }
        if (await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Sluiten zonder opslaan")) {
            return true;
        }
        return false;
    }

    openChangePassword() {
        this.present(new ComponentWithProperties(ChangePasswordView, {}).setDisplayStyle("sheet"))
    }

    async logout() {
        if (await CenteredMessage.confirm("Ben je zeker dat je wilt uitloggen?", "Uitloggen")) {
            this.$context.logout()
        }
    }
}
</script>
