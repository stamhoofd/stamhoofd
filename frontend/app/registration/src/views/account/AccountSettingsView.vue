<template>
    <div id="account-view" class="st-view">
        <STNavigationBar title="Mijn account">
            <BackButton v-if="canPop" slot="left" @click="pop" />
        </STNavigationBar>


        <main class="limit-width">
            <section class="white-top view">
                <main class="container">
                    <h1>
                        Mijn account
                    </h1>
                    <p>Met een account kan je één of meerdere leden beheren.</p>
                
                    <STErrorsDefault :error-box="errorBox" />

                    <STInputBox v-if="isAdmin" title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>

                    <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />

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
                <STToolbar :sticky="false">
                    <template slot="right">
                        <LoadingButton :loading="saving">
                            <button class="button primary" @click="save">
                                Opslaan
                            </button>
                        </LoadingButton>
                    </template>
                </STToolbar>
            </section>
            <PaymentsView class="gray-shadow view" />
        </main>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, HistoryManager, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage,ChangePasswordView, Checkbox, ConfirmEmailView, DateSelection, EmailInput, ErrorBox, LoadingButton, RadioGroup, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, Toast,Validator } from "@stamhoofd/components";
import { LoginHelper,SessionManager } from '@stamhoofd/networking';
import { Organization, OrganizationPatch, User, Version } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from '../../classes/OrganizationManager';
import PaymentsView from "./PaymentsView.vue"

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
    session = SessionManager.currentSession!
    
    get user() {
        console.log("user updated!")
        return User.create(SessionManager.currentSession!.user!)
    }

    userPatch = User.patch({ id: this.user.id })
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get patchedUser() {
        return this.user.patch(this.userPatch)
    }

    get email() {
        return this.patchedUser.email
    }

    get isAdmin() {
        return this.user.permissions !== null
    }

    set email(email: string) {
        this.$set(this.userPatch, "email", email)
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
        if (OrganizationManager.organization.meta.privacyPolicyUrl) {
            return OrganizationManager.organization.meta.privacyPolicyUrl
        }
        if (OrganizationManager.organization.meta.privacyPolicyFile) {
            return OrganizationManager.organization.meta.privacyPolicyFile.getPublicPath()
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
            const result = await LoginHelper.patchUser(SessionManager.currentSession!, this.userPatch)

            if (result.verificationToken) {
                this.present(new ComponentWithProperties(ConfirmEmailView, { session: SessionManager.currentSession!, token: result.verificationToken }).setDisplayStyle("sheet"))
            } else {
                const toast = new Toast('De wijzigingen zijn opgeslagen', "success green")
                toast.show()
            }

            // Create a new patch
            this.userPatch = User.patch({ id: this.user.id })
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
            SessionManager.currentSession?.logout()
        }
    }
    

}
</script>
