<template>
    <div class="st-view background" id="account-view">
        <STNavigationBar title="Mijn account">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
        </STNavigationBar>

        <main>
            <h1>
                Mijn account
            </h1>
        
            <STErrorsDefault :error-box="errorBox" />

            <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
                <div class="input-group">
                    <div>
                        <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                    </div>
                    <div>
                        <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                    </div>
                </div>
            </STInputBox>

            <EmailInput title="E-mailadres" v-model="email" :validator="validator" placeholder="Vul jouw e-mailadres hier in" autocomplete="username"/>

            <button class="button text" @click="openChangePassword">Wachtwoord wijzigen</button>

        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, patchContainsChanges } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin, NavigationController } from "@simonbackx/vue-app-navigation";
import { BirthYearInput, DateSelection, ErrorBox, BackButton, RadioGroup, Checkbox, STErrorsDefault,STInputBox, STNavigationBar, STToolbar, AddressInput, Validator, LoadingButton, EmailInput, Toast } from "@stamhoofd/components";
import { SessionManager, LoginHelper } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationMetaData, Image, ResolutionRequest, ResolutionFit, Version, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DomainSettingsView from './DomainSettingsView.vue';
import DNSRecordsView from './DNSRecordsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import ChangePasswordView from './ChangePasswordView.vue';

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
        EmailInput
    },
})
export default class AccountSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    showDomainSettings = true
    
    get user() {
        return SessionManager.currentSession!.user!
    }

    userPatch = User.patch({ id: this.user.id })
    organizationPatch: AutoEncoderPatchType<Organization> & AutoEncoder = OrganizationPatch.create({ id: OrganizationManager.organization.id })

    get patchedUser() {
        return this.user.patch(this.userPatch)
    }

    get email() {
        return this.patchedUser.email
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
            await LoginHelper.patchUser(SessionManager.currentSession!, this.userPatch)
            const toast = new Toast('De wijzigingen zijn opgeslagen', "success green")
            toast.withOffset = true
            toast.show()
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    shouldNavigateAway() {
        if (!patchContainsChanges(this.userPatch, this.user, { version: Version })) {
            return true;
        }
        if (confirm("Ben je zeker dat je de instellingen wilt sluiten zonder op te slaan?")) {
            return true;
        }
        return false;
    }

    openChangePassword() {
        this.present(new ComponentWithProperties(ChangePasswordView, {}).setDisplayStyle("sheet"))
    }

}
</script>
