<template>
    <SaveView :loading="saving" title="Beheerder" :disabled="!isNew && !hasChanges" @save="save">
        <h1 v-if="isNew && !forceCreate">
            Beheerder toevoegen
        </h1>
        <h1 v-else>
            Beheerder bewerken
        </h1>

        <button v-if="forceCreate || (!isNew && !user)" class="warning-box with-button selectable" type="button" @click="resendInvite">
            Deze beheerder heeft de uitnodiging nog niet geaccepteerd

            <span class="button text">
                Opnieuw versturen
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

        <EmailInput v-model="email" :title="!!user ? 'E-mailadres' : 'E-mailadres (optioneel)'" :validator="validator" placeholder="E-mailadres" :required="!!user" />

        <div class="container">
            <hr>
            <h2>Beheerdersgroepen</h2>
            <p>Je kan beheerders in groepen onderverdelen. Zonder een groep heeft deze beheerder nergens toegang tot (tenzij voor hoofdbeheerders). Je kan groepen aanpassen en toevoegen in het overzicht van 'beheerders'.</p>

            <STList>
                <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                    <Checkbox slot="left" v-model="fullAccess" />
                    Hoofdbeheerders

                    <template #right>
                        Kan alles bekijken en bewerken
                    </template>
                </STListItem>

                <STListItem v-for="role in roles" :key="role.id" element-name="label" :selectable="true" class="right-description smartphone-wrap">
                    <Checkbox slot="left" :checked="getRole(role)" @change="setRole(role, $event)" />
                    {{ role.name }}
                </STListItem>
            </STList>

            <p v-if="roles.length == 0" class="info-box">
                Je hebt nog geen beheerdersgroepen aangemaakt. Maak een groep aan om beheerders op te delen.
            </p>

            <p>
                <button class="button text" type="button" @click="addRole">
                    <span class="icon add" />
                    <span>Nieuwe groep toevoegen</span>
                </button>
            </p>
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
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PartialWithoutMethods, patchContainsChanges, PatchType, VersionBox } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, Spinner, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import Tooltip from '@stamhoofd/components/src/directives/Tooltip';
import { Keychain, SessionManager } from '@stamhoofd/networking';
import { Invite, InviteUserDetails, KeychainedResponseDecoder, NewInvite, Organization, OrganizationKeyUser, OrganizationPrivateMetaData, PermissionLevel, PermissionRole, PermissionRoleDetailed, Permissions, User, Version } from "@stamhoofd/structures";
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager";
import EditRoleView from './EditRoleView.vue';
import SendInviteView from './SendInviteView.vue';

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        EmailInput,
        STList,
        STListItem,
        Spinner,
        SaveView
    },
    directives: {
        tooltip: Tooltip
    },
    filters: {
        date: Formatter.date.bind(Formatter)
    }
})
export default class AdminInviteView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false
    deleting = false

    // Use when creating a new user
    createInvite = NewInvite.create({ 
        userDetails: InviteUserDetails.create({}), 
        permissions: Permissions.create({ level: PermissionLevel.None }) 
    })

    // Use when editing a user
    patchUser: AutoEncoderPatchType<User> | null = null

    // use when editing an invite
    patchInvite: AutoEncoderPatchType<Invite> | null = null
    
    @Prop({ default: null })
    editInvite: Invite | null

    @Prop({ default: null })
    editUser: User | null

    @Prop({ default: null })
    onUpdateUser: ((user: User | null)  => void) | null

    @Prop({ default: null })
    onUpdateInvite: ((invite: Invite | null) => void) | null

    forceCreate = false

    loadingKeys = false
    availableKeys: OrganizationKeyUser[] = []

    get hasChanges() {
        if (this.editUser) {
            if (!this.patchUser) {
                return false
            }
            return patchContainsChanges(this.patchUser, this.editUser, { version: Version })
        }

        if (!this.editInvite) {
            return false
        }

        if (!this.patchInvite) {
            return false
        }

        return patchContainsChanges(this.patchInvite, this.editInvite, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
    }

    get isNew() {
        return this.forceCreate || (!this.editInvite && !this.editUser)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get roles() {
        return this.organization.privateMeta?.roles ?? []
    }

    getRole(role: PermissionRole) {
        return !!(this.user ?? this.invite).permissions?.roles.find(r => r.id === role.id)
    }

    setRole(role: PermissionRole, enable: boolean) {
        const p = Permissions.patch({})

        if (enable) {
            if (this.getRole(role)) {
                return
            }
            p.roles.addPut(role)
        } else {
            p.roles.addDelete(role.id)
        }
        this.addPermissionsPatch(p)
    }

    addRole() {
        const role = PermissionRoleDetailed.create({})
        const privateMeta = OrganizationPrivateMetaData.patch({})
        privateMeta.roles.addPut(role)

        const patch = Organization.patch({ 
            id: this.organization.id,
            privateMeta
        })
        
        this.present(new ComponentWithProperties(NavigationController, { 
            root: new ComponentWithProperties(EditRoleView, { 
                role,
                organization: this.organization.patch(patch),
                saveHandler: async (p: AutoEncoderPatchType<Organization>) => {
                    const doSave = patch.patch(p)
                    await OrganizationManager.patch(doSave)
                }
            }),
        }).setDisplayStyle("popup"))
    }

    mounted() {
        if (this.editUser) {
            this.downloadKeys().catch(e => {
                console.error(e)
                this.errorBox = new ErrorBox(e)
            })
        }
    }

    get user() {
        if (this.editUser) {
            if (this.patchUser) {
                return this.editUser.patch(this.patchUser)
            }
            return this.editUser
        }
        return null;
    }

    get invite() {
        if (this.editInvite && !this.forceCreate) {
            if (this.patchInvite) {
                return this.editInvite.patch(this.patchInvite)
            }
            return this.editInvite
        }
        return this.createInvite;
    }

    async downloadKeys() {
        this.loadingKeys = true

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "GET",
                path: "/organization/admins/"+this.editUser!.id+"/keys",
                decoder: new KeychainedResponseDecoder(new ArrayDecoder(OrganizationKeyUser as Decoder<OrganizationKeyUser>))
            })

            // Load all the keys (so we can check if we have access to all the needed keys or not)
            Keychain.addItems(response.data.keychainItems)

            // Set the keys
            this.availableKeys = response.data.data
        } catch (e) {
            console.error(e)
        }
        
        this.loadingKeys = false
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

        // todo: validate if at least email or name is filled in

        if (!valid) {
            this.saving = false
            return;
        }

        const permissions = Permissions.patch({ level: this.fullAccess ? PermissionLevel.Full : (PermissionLevel.None )})

        this.addPermissionsPatch(permissions)

        if (this.isNew) {
            // Encrypt keychain items
            this.createInvite.keychainItems = null

            try {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/invite",
                    body: this.invite,
                    decoder: Invite as Decoder<Invite>
                })

                if (this.onUpdateInvite) {
                    this.onUpdateInvite(response.data);
                }

                // Remove patches
                this.editInvite?.set(response.data)
                this.patchInvite = null

                const component = new ComponentWithProperties(SendInviteView, { invite: response.data })
                if (this.forceCreate) {
                    this.present({ components: [component], modalDisplayStyle: "popup" })
                } else {
                    this.show(component)
                }

                this.saving = false
            } catch (e) {
                console.error(e)
                this.errorBox = new ErrorBox(e)
                this.saving = false
            }
        } else {
            if (this.user) {
                if (!this.patchUser) {
                    // no changes
                    this.saving = false;
                    this.pop({ force: true })
                    return;
                }
                // Patch the user

                try {
                    const response = await SessionManager.currentSession!.authenticatedServer.request({
                        method: "PATCH",
                        path: "/user/"+this.user.id,
                        body: this.patchUser,
                        decoder: User as Decoder<User>
                    })

                    if (this.onUpdateUser) this.onUpdateUser(response.data);

                    this.pop({ force: true })
                    this.saving = false
                } catch (e) {
                    console.error(e)
                    this.errorBox = new ErrorBox(e)
                    this.saving = false
                }
            } else {
                if (!this.patchInvite) {
                    // no changes
                    this.saving = false;
                    this.pop({ force: true })
                    return;
                }
                // Patch the user

                try {
                    const response = await SessionManager.currentSession!.authenticatedServer.request({
                        method: "PATCH",
                        path: "/invite/"+this.editInvite!.id,
                        body: this.patchInvite,
                        decoder: Invite as Decoder<Invite>
                    })

                    if (this.onUpdateInvite) this.onUpdateInvite(response.data);

                    this.pop({ force: true })
                    this.saving = false
                } catch (e) {
                    console.error(e)
                    this.errorBox = new ErrorBox(e)
                    this.saving = false
                }
            }
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
            if (this.user) {
                // Patch the user
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "DELETE",
                    path: "/user/"+this.user.id,
                })

                if (this.onUpdateUser) {
                    this.onUpdateUser(null);
                }
                if (!force) {
                    this.pop({ force: true })
                }
                this.deleting = false
                return true;
                
            } else {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "DELETE",
                    path: "/invite/"+this.editInvite!.id,
                })

                if (this.onUpdateInvite) {
                    this.onUpdateInvite(null);
                }
                if (!force) {
                    this.pop({ force: true })
                }
                this.deleting = false
                return true;
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.deleting = false
        }
        return false;
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addUserPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        if (!this.patchUser) {
            this.patchUser = User.patch({ id: this.editUser!.id }).patch(patch)
        } else {
            this.patchUser = this.patchUser.patch(patch)
        }
    }

    addInviteUserPatch(patch: PartialWithoutMethods<PatchType<InviteUserDetails>>) {
        this.addInvitePatch({ userDetails: InviteUserDetails.patch(patch) })
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        if (this.user) {
            // User always have permission set, so no need to check if it already is created
            this.addUserPatch({ permissions: Permissions.patch(patch) })
            return
        }
        // Invite always have permission set, so no need to check if it already is created
        this.addInvitePatch({ permissions: Permissions.patch(patch) })
    }

    addInvitePatch(patch: PartialWithoutMethods<PatchType<Invite>>) {
        if (!this.editInvite || this.forceCreate) {

            this.createInvite = this.createInvite.patch(NewInvite.patchType().create(patch))
            return
        }
        if (!this.patchInvite) {
            this.patchInvite = Invite.patchType().create(patch)
        } else {
            this.patchInvite = this.patchInvite.patch(Invite.patchType().create(patch))
        }
    }

    /// --------------------------------------------------------
    /// --------------------- Mappers --------------------------
    /// --------------------------------------------------------

    get firstName() {
        if (this.user) {
            return this.user.firstName ?? ""
        }
        return this.invite.userDetails?.firstName ?? ""
    }

    set firstName(firstName: string) {
        if (this.user) {
            this.addUserPatch({ firstName: firstName.length == 0 ? null : firstName })
            return
        }
        this.addInviteUserPatch({ firstName: firstName.length == 0 ? null : firstName })
    }

    get lastName() {
        if (this.user) {
            return this.user.lastName ?? ""
        }
        return this.invite.userDetails?.lastName ?? ""
    }

    set lastName(lastName: string) {
        if (this.user) {
            this.addUserPatch({ lastName: lastName.length == 0 ? null : lastName })
            return
        }
        this.addInviteUserPatch({ lastName: lastName.length == 0 ? null : lastName })
    }

    get email() {
        if (this.user) {
            return this.user.email ?? ""
        }
        return this.invite.userDetails?.email ?? ""
    }

    set email(email: string | null) {
        if (this.user) {
            this.addUserPatch({ email: email ?? this.user.email ?? ""})
            return
        }
        this.addInviteUserPatch({ email: !email || email.length == 0 ? null : email })
    }

    get fullAccess() {
        const user = this.user ?? this.invite
        return !!user.permissions && user.permissions.hasFullAccess()
    }

    set fullAccess(fullAccess: boolean) {
        if (fullAccess && this.fullAccess) {
            return
        }

        if (fullAccess) {
            this.addPermissionsPatch({ level: PermissionLevel.Full })
        } else {
            this.addPermissionsPatch({ level: PermissionLevel.None })
        }
    }

    async resendInvite() {
        // Delete invite and create it again
        this.createInvite = NewInvite.create({
            keychainItems: null,
            memberIds: null,
            permissions: this.invite.permissions,
            userDetails: this.invite.userDetails
        })

        // First delete
        if (await this.deleteMe(true)) {
            this.forceCreate = true
            await this.save()
            this.forceCreate = false
        }
    }
}
</script>