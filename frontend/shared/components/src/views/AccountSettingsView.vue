<template>
    <div id="account-view" class="st-view">
        <STNavigationBar title="Mijn account" />

        <main class="center">
            <h1>
                Mijn account
            </h1>
            <p>Met een account kan je één of meerdere leden beheren.</p>

            <p v-if="isUserModeOrganization && patchedUser.organizationId === null" class="error-box icon privacy">
                Dit is een platform account
            </p>
        
            <STErrorsDefault :error-box="errorBox" />

            <form @submit.prevent="save">
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

                <div class="style-button-bar">
                    <LoadingButton :loading="saving" class=" ">
                        <button id="submit" class="button primary" type="submit">
                            <span>Opslaan</span>
                        </button>
                    </LoadingButton>
                </div>
            </form>

            <hr>

            <STList>
                <STListItem :selectable="true" @click.prevent="openChangePassword">
                    <template #left>
                        <span class="icon key" />
                    </template>

                    <h3 class="style-title-list">
                        Wachtwoord wijzigen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="deleteRequest">
                    <template #left>
                        <LoadingButton :loading="deletingAccount">
                            <span class="icon trash" />
                        </LoadingButton>
                    </template>


                    <h3 class="style-title-list">
                        Account verwijderen
                    </h3>
                </STListItem>

                <STListItem :selectable="true" @click.prevent="logout">
                    <template #left>
                        <span class="icon logout" />
                    </template>

                    <h3 class="style-title-list">
                        Uitloggen
                    </h3>
                </STListItem>
            </STList>

            <template v-if="policies.length">
                <p class="style-button-bar">
                    <a v-for="policy of policies" :key="policy.id" class="button text" type="button" :href="policy.url" target="_blank">
                        <span>{{ policy.name }}</span>
                    </a>
                </p>
            </template>
        </main>
    </div>
</template>

<script lang="ts">
import { patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { Component, Mixins } from "@simonbackx/vue-app-navigation/classes";
import { BackButton, CenteredMessage, ChangePasswordView, Checkbox, ConfirmEmailView, DateSelection, EmailInput, ErrorBox, LoadingButton, RadioGroup, STErrorsDefault, STInputBox, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { LoginHelper } from '@stamhoofd/networking';
import { User, Version } from "@stamhoofd/structures";
import { sleep } from '@stamhoofd/utility';


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
    navigation: {
        title: 'Mijn account'
    }
})
export default class AccountSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    showDomainSettings = true
    
    userPatch = User.patch({})
    deletingAccount = false;

    created() {
        this.userPatch.id = this.$user!.id
    }

    mounted() {
        // Refresh
        this.$context.fetchUser(false).catch(console.error)
    }

    get patchedUser() {
        return this.$user!.patch(this.userPatch)
    }

    get isUserModeOrganization() {
        return STAMHOOFD.userMode === 'organization'
    }

    get email() {
        return this.patchedUser.email
    }

    set email(email: string) {
        this.userPatch = this.userPatch.patch({
            email
        })
    }

    get isAdmin() {
        return !!this.$user?.permissions 
    }

    get firstName() {
        return this.patchedUser.firstName
    }

    set firstName(firstName: string | null) {
        this.userPatch = this.userPatch.patch({
            firstName
        })
    }

    get lastName() {
        return this.patchedUser.lastName
    }

    set lastName(lastName: string | null) {
        this.userPatch = this.userPatch.patch({
            lastName
        })
    }

    get policies() {
        return this.$platform.config.privacy.policies
    }

    get privacyUrl() {
        if (!this.$organization) {
            return null;
        }

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
            this.userPatch = User.patch({ id: this.$user!.id })
            this.dismiss({force: true});
        } catch (e) {
            this.errorBox = new ErrorBox(e)
        }

        this.saving = false
    }

    async deleteRequest() {
        this.deletingAccount = true;

        try {
            await sleep(2000)

            if (await CenteredMessage.confirm("Ben je zeker dat je jouw account wilt verwijderen?", "Verwijderen", "Al jouw gegevens gaan verloren. Je kan dit niet ongedaan maken.")) {
                await this.$context.deleteAccount()

                Toast.success("Je account is verwijderd. Het kan even duren voor jouw aanvraag volledig is verwerkt.").show()
                await this.pop({force: true})
            }
        } finally {
            this.deletingAccount = false
        }
    }

    async shouldNavigateAway() {
        if (!patchContainsChanges(this.userPatch, this.$user!, { version: Version })) {
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
            await this.$context.logout()
            await this.pop({force: true})
        }
    }
}
</script>
