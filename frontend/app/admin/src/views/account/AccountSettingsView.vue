<template>
    <SaveView id="account-view" class="st-view" title="Mijn account" data-submit-last-field @save="save">
        <h1>
            Mijn account
        </h1>
        
        <STErrorsDefault :error-box="errorBox" />

        <EmailInput v-model="email" enterkeyhint="go" title="E-mailadres" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username" />

        <hr>

        <button class="button text" type="button" @click="openChangePassword">
            <span class="icon key" />
            <span>Wachtwoord wijzigen</span>
        </button>
    </SaveView>
</template>

<script lang="ts">
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, CenteredMessage, Checkbox, EmailInput, ErrorBox, LoadingButton, SaveView, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { UrlHelper } from '@stamhoofd/networking';
import { Admin, EditAdmin,Version } from "@stamhoofd/structures";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";

import { AdminSession } from '../../classes/AdminSession';
import ChangePasswordView from './ChangePasswordView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        SaveView,
        BackButton,
        LoadingButton,
        EmailInput
    },
})
export default class AccountSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    showDomainSettings = true
    AdminSessionShared = AdminSession.shared
    
    get user() {
        return AdminSession.shared.user!
    }

    userPatch = Admin.patch({ id: this.user.id })

    mounted() {
        UrlHelper.setUrl("/account")
        document.title = "Stamhoofd - Mijn account"
    }

    get patchedUser() {
        return this.user.patch(this.userPatch)
    }

    get email() {
        return this.patchedUser.email
    }

    set email(email: string) {
        this.$set(this.userPatch, "email", email)
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
            await AdminSession.shared.patchUser(EditAdmin.patch(this.userPatch))
            const toast = new Toast('De wijzigingen zijn opgeslagen', "success green")
            toast.show()

            // Create a new patch
            this.userPatch = Admin.patch({ id: this.user.id })
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false

        if (this.canPop) {
            this.pop({ force: true })
        }
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
}
</script>
