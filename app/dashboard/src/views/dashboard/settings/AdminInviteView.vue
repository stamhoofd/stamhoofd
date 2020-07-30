<template>
    <div class="st-view" id="settings-view">
        <STNavigationBar title="Beheerder">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button class="button text" slot="right" v-if="!isNew" @click="deleteMe">
                <span class="icon trash"/>
                <span>Verwijderen</span>
            </button>
            <button slot="right" class="button icon close gray" v-if="canDismiss && !canPop" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Beheerder toevoegen
            </h1>
            <h1 v-else>
                Beheerder bewerken
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

            <EmailInput :title="!!user ? 'E-mailadres' : 'E-mailadres (optioneel)'" :validator="validator" v-model="email" placeholder="E-mailadres" :required="!!user"/>
        
            <hr>
            <h2>Geef toegang tot...</h2>

            <STList>
                <STListItem element-name="label" :selectable="true" class="right-description">
                    <Checkbox slot="left" v-model="fullAccess"/>
                    Maak administrator

                    <template #right>Kan alle instellingen en beheerders bewerken</template>
                </STListItem>
                <STListItem v-if="!fullAccess" element-name="label" :selectable="true" class="right-description">
                    <Checkbox slot="left" v-model="writeAccess"/>
                    Toegang tot alle groepen

                    <template #right>Kan alle leden bekijken en bewerken</template>
                </STListItem>
                <template v-if="!writeAccess && !fullAccess">
                    <STListItem element-name="label" :selectable="true" v-for="group in groups" :key="group.group.id">
                        <Checkbox slot="left" v-model="group.selected"/>
                        {{ group.group.settings.name }}
                    </STListItem>
                </template>
                
            </STList>

        </main>

        <STToolbar>
            <template slot="right">
                <LoadingButton :loading="saving">
                    <button class="button primary" @click="save" v-if="isNew">
                        Toevoegen
                    </button>
                    <button class="button primary" @click="save" v-else>
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder, PatchableArray, VersionBox } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, Validator, EmailInput, STList, STListItem } from "@stamhoofd/components";
import { SessionManager, Keychain } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord, OrganizationEmail, OrganizationPrivateMetaData, Version, GroupPrivateSettingsPatch, NewInvite, InviteUserDetails, Permissions, PermissionLevel, GroupPermissions, Invite, InviteKeychainItem, User } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsView from './DNSRecordsView.vue';
import { Sodium } from '@stamhoofd/crypto';
import SendInviteView from './SendInviteView.vue';

class SelectableGroup {
    group: Group;
    selected: boolean = false;
    constructor(group: Group, selected: boolean = false) {
        this.selected = selected
        this.group = group
    }
}

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        EmailInput,
        STList,
        STListItem
    },
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
    patchUser: PatchType<Invite> | null = null

    // use when editing an invite
    patchInvite: PatchType<Invite> | null = null

    groups: SelectableGroup[] = []
    
    /*fullAccess = false
    writeAccess = false*/

    @Prop({ default: null })
    editInvite: Invite | null

    @Prop({ default: null })
    editUser: User | null

    @Prop({ default: null })
    onUpdateUser: ((user: User | null)  => void) | null

    @Prop({ default: null })
    onUpdateInvite: ((invite: Invite | null) => void) | null

    get isNew() {
        return !this.editInvite && !this.editUser
    }

    get organization() {
        return OrganizationManager.organization
    }

    mounted() {
        for (const group of this.organization.groups) {
            
            this.groups.push(new SelectableGroup(group, (this.user ?? this.invite).permissions?.hasWriteAccess(group.id) ?? false))
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
        if (this.editInvite) {
            if (this.patchInvite) {
                return this.editInvite.patch(this.patchInvite)
            }
            return this.editInvite
        }
        return this.createInvite;
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

        const permissions = Permissions.create({ level: this.fullAccess ? PermissionLevel.Full : (this.writeAccess ? PermissionLevel.Write : PermissionLevel.None )})

        if (!this.writeAccess && !this.fullAccess) {
            for (const group of this.groups) {
                if (group.selected) {
                    permissions.groups.push(GroupPermissions.create({
                        groupId: group.group.id,
                        level: PermissionLevel.Write
                    }))
                }
            }
        }
        this.addPermissionsPatch(permissions)

        if (this.isNew) {
            // Encrypt keychain items
            const secret = await Sodium.generateSecretKey()
            const keychainItem = Keychain.getItem(OrganizationManager.organization.publicKey)

            if (!keychainItem) {
                throw new Error("Missing organization keychain")
            }

            const session = SessionManager.currentSession!
            const keyPair = await session.decryptKeychainItem(keychainItem)

            const items = new VersionBox([InviteKeychainItem.create({
                publicKey: keyPair.publicKey,
                privateKey: keyPair.privateKey
            })])

            this.createInvite.keychainItems = await Sodium.encryptMessage(JSON.stringify(items.encode({ version: Version })), secret)

            try {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "POST",
                    path: "/invite",
                    body: this.invite,
                    decoder: Invite as Decoder<Invite>
                })

                if (this.onUpdateInvite) this.onUpdateInvite(response.data);

                this.show(new ComponentWithProperties(SendInviteView, { secret, invite: response.data }))
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

    async deleteMe() {
        if (this.deleting || this.saving) {
            return;
        }
        
        if (this.isNew) {
            return;
        }

        if (!confirm("Ben je zeker dat je deze beheerder wilt verwijderen?")) {
            return;
        }

        this.deleting = true;

        try {
            if (this.user) {
                // Patch the user
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "DELETE",
                    path: "/user/"+this.user.id,
                })

                if (this.onUpdateUser) this.onUpdateUser(null);
                this.pop({ force: true })
                this.saving = false
                
            } else {
                const response = await SessionManager.currentSession!.authenticatedServer.request({
                    method: "DELETE",
                    path: "/invite/"+this.editInvite!.id,
                })

                if (this.onUpdateInvite) this.onUpdateInvite(null);
                this.pop({ force: true })
                this.saving = false
            }
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }

    /// --------------------------------------------------------
    /// --------------------- Map helpers ----------------------
    /// --------------------------------------------------------

    addUserPatch(patch: PartialWithoutMethods<PatchType<User>>) {
        if (!this.patchUser) {
            this.patchUser = User.patchType().create(patch)
        } else {
            this.patchUser = this.patchUser.patch(User.patchType().create(patch))
        }
    }

    addInviteUserPatch(patch: PartialWithoutMethods<PatchType<InviteUserDetails>>) {
        this.addInvitePatch({ userDetails: InviteUserDetails.patchType().create(patch) })
    }

    addPermissionsPatch(patch: PartialWithoutMethods<PatchType<Permissions>>) {
        if (this.user) {
            // User always have permission set, so no need to check if it already is created
            this.addUserPatch({ permissions: Permissions.patchType().create(patch) })
            return
        }
        // Invite always have permission set, so no need to check if it already is created
        this.addInvitePatch({ permissions: Permissions.patchType().create(patch) })
    }

    addInvitePatch(patch: PartialWithoutMethods<PatchType<Invite>>) {
        if (!this.editInvite) {

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
        const user = this.user
        if (this.user) {
            return this.user.firstName ?? ""
        }
        return this.invite.userDetails?.firstName ?? ""
    }

    set firstName(firstName: string) {
        const user = this.user
        if (this.user) {
            this.addUserPatch({ firstName: firstName.length == 0 ? null : firstName })
            return
        }
        this.addInviteUserPatch({ firstName: firstName.length == 0 ? null : firstName })
    }

    get lastName() {
        const user = this.user
        if (this.user) {
            return this.user.lastName ?? ""
        }
        return this.invite.userDetails?.lastName ?? ""
    }

    set lastName(lastName: string) {
        const user = this.user
        if (this.user) {
            this.addUserPatch({ lastName: lastName.length == 0 ? null : lastName })
            return
        }
        this.addInviteUserPatch({ lastName: lastName.length == 0 ? null : lastName })
    }

    get email() {
        const user = this.user
        if (this.user) {
            return this.user.email ?? ""
        }
        return this.invite.userDetails?.email ?? ""
    }

    set email(email: string | null) {
        const user = this.user
        if (this.user) {
            this.addUserPatch({ email: email ?? this.user.email ?? ""})
            return
        }
        this.addInviteUserPatch({ email: !email || email.length == 0 ? null : email })
    }


    get writeAccess() {
        const user = this.user ?? this.invite
        return !!user.permissions && user.permissions.hasWriteAccess()
    }

    set writeAccess(writeAccess: boolean) {
        if (writeAccess && this.writeAccess) {
            return
        }

        if (writeAccess) {
            this.addPermissionsPatch({ level: PermissionLevel.Write })
        } else {
            this.addPermissionsPatch({ level: PermissionLevel.None })
        }
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
            this.addPermissionsPatch({ level: this.writeAccess ? PermissionLevel.Write : PermissionLevel.None })
        }
    }
   


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
