<template>
    <SaveView :loading="saving" title="Beheerder" :disabled="!isNew && !hasChanges" @save="save">
        <h1 v-if="isNew">
            Beheerder toevoegen
        </h1>
        <h1 v-else>
            Beheerder bewerken
        </h1>

        <button v-if="!isNew && !user.hasAccount" class="warning-box with-button" type="button" :class="{selectable: !didSendInvite}" @click="resendInvite">
            Deze beheerder heeft nog geen account aangemaakt

            <span class="button text" :class="{disabled: didSendInvite}">
                Uitnodiging opnieuw versturen
            </span>
        </button>

        <STErrorsDefault :error-box="errorBox" />
        <STInputBox title="Naam" error-fields="firstName,lastName" :error-box="errorBox">
            <div class="input-group">
                <div>
                    <input v-model="firstName" enterkeyhint="next" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                </div>
                <div>
                    <input v-model="lastName" enterkeyhint="next" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                </div>
            </div>
        </STInputBox>

        <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="E-mailadres" :required="true" />

        <div class="container">
            <hr>
            <h2>Rollen</h2>
            <p>Je kan beheerders verschillende rollen toekennen. Een beheerder zonder rollen heeft geen enkele toegang.</p>

            <EditUserPermissionsBox :user="patchedUser" @patch="addPatch($event)" />
        </div>

        <hr v-if="!isNew">
        <h2 v-if="!isNew">
            Verwijderen
        </h2>

        <button v-if="!isNew" class="button secundary danger" type="button" @click="deleteMe(false)">
            <span class="icon trash" />
            <span>Verwijderen</span>
        </button>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, Decoder, PartialWithoutMethods, patchContainsChanges, PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import Tooltip from '@stamhoofd/components/src/directives/Tooltip';
import { SessionManager } from '@stamhoofd/networking';
import { PermissionLevel, PermissionRole, Permissions, User, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import AdminRolesView from './AdminRolesView.vue';
import EditUserPermissionsBox from './EditUserPermissionsBox.vue';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        EmailInput,
        STList,
        STListItem,
        Spinner,
        SaveView,
        EditUserPermissionsBox
    },
    directives: {
        tooltip: Tooltip
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class AdminView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    deleting = false

    @Prop({ required: true })
        user!: User

    patchUser: AutoEncoderPatchType<User> = User.patch({ id: this.user.id })

    @Prop({ required: true })
        isNew!: boolean

    get hasChanges() {
        return patchContainsChanges(this.patchUser, this.user, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    get organization() {
        return OrganizationManager.organization
    }

    get patchedUser() {
        return this.user.patch(this.patchUser)
    }

    get fullAccess() {
        const user = this.patchedUser
        return !!user.permissions && user.permissions.hasFullAccess(this.organization.privateMeta?.roles ?? [])
    }

    async save() {
        if (this.deleting || this.saving) {
            return;
        }

        this.saving = true

        const errors = new SimpleErrors()

        if (this.firstName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de voornaam in",
                field: "firstName"
            }))
        }
        if (this.lastName.length < 2) {
            errors.addError(new SimpleError({
                code: "invalid_field",
                message: "Vul de achternaam in",
                field: "lastName"
            }))
        }
        
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        // TODO: validate if at least email or name is filled in

        if (!valid) {
            this.saving = false
            return;
        }

        const permissions = Permissions.patch({ level: this.fullAccess ? PermissionLevel.Full : (PermissionLevel.None )})

        this.addPermissionsPatch(permissions)

        try {
            let user: User;
            if (this.isNew) {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/user",
                    body: this.patchedUser,
                    decoder: User as Decoder<User>
                })
                user = response.data;
                new Toast("Beheerder "+user.firstName+" is toegevoegd en heeft een uitnodiging via email ontvangen.", "success").setHide(5000).show()
            } else {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "PATCH",
                    path: "/user/"+this.user.id,
                    body: this.patchUser,
                    decoder: User as Decoder<User>
                })
                user = response.data;
                new Toast("Beheerder "+user.firstName+" is aangepast", "success").setHide(2000).show()
            }

            // Copy all data
            this.user.set(user);
            this.patchUser = User.patch({ id: this.user.id });

            // Push user to admins
            if (this.isNew) {
                this.organization.admins?.push(this.user)
            }

            this.pop({ force: true })
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }

    async deleteMe(force = false) {
        if (this.deleting || this.saving) {
            return false;
        }
        
        if (this.isNew) {
            return false;
        }

        if (!force && !await CenteredMessage.confirm("Ben je zeker dat je deze beheerder wilt verwijderen?", "Verwijderen")) {
            return false;
        }

        this.deleting = true;

        try {
            // Patch the user
            await SessionManager.currentSession!.authenticatedServer.request({
                method: "PATCH",
                path: "/user/"+this.user.id,
                body: User.patch({
                    id: this.user.id,
                    permissions: null
                }),
                decoder: User as Decoder<User>
            })

            if (!force) {
                this.pop({ force: true })
            }
            this.deleting = false

            new Toast("Beheerder "+this.user.firstName+" is verwijderd", "success").setHide(2000).show()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.deleting = false;
        }
        return false;
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        this.patchUser = this.patchUser.patch(patch)
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        this.addPatch({ permissions: Permissions.patch(patch) })
    }


    /// --------------------------------------------------------
    /// --------------------- Mappers --------------------------
    /// --------------------------------------------------------

    get firstName() {
        return this.patchedUser.firstName ?? ""
    }

    set firstName(firstName: string) {
        this.addPatch({ firstName: firstName.length == 0 ? null : firstName })
    }

    get lastName() {
        return this.patchedUser.lastName ?? ""
    }

    set lastName(lastName: string) {
        this.addPatch({ lastName: lastName.length == 0 ? null : lastName })
    }

    get email() {
        return this.patchedUser.email
    }

    set email(email: string) {
        this.addPatch({ email })
    }

    sendingInvite = false
    didSendInvite = false

    async resendInvite() {
        if (this.sendingInvite || this.didSendInvite) {
            return
        }
        // We can send a new invite by just recreating the admin (the API will merge with existing admins)
        if (this.hasChanges) {
            new CenteredMessage('Wijzigingen niet opgeslagen', 'Voor je een uitnodiging opnieuw kan versturen moet je alle wijzigingen opslaan of annuleren.').addCloseButton().show()
            return
        }
        this.sendingInvite = true

        try {
            let user: User;

            // Note: we don't use the patchedUser, because that would save any changes too
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/user",
                body: this.user,
                decoder: User as Decoder<User>
            })
            user = response.data;

            // Copy all data
            this.user.set(user);
            this.didSendInvite = true

            new Toast("Uitnodiging verzonden naar "+this.user.email, "success").setHide(2000).show()
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            
        }
        this.sendingInvite = false
    }
}
</script>