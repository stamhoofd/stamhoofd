<template>
    <div id="settings-view" class="st-view">
        <STNavigationBar title="Beheerder">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!isNew" slot="right" class="button text only-icon-smartphone" @click="deleteMe(false)">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
            <button v-if="canDismiss && !canPop" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                Beheerder toevoegen
            </h1>
            <h1 v-else>
                Beheerder bewerken
            </h1>

            <p v-if="isNew" class="info-box">
                Vul een e-mailadres in om ervoor te zorgen dat de uitnodiging langer geldig is (7 dagen i.p.v. 4 uur). Zorg wel dat dit een juist e-mailadres is, want een verificatie is nodig via e-mail.
            </p>

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

            <EmailInput v-model="email" :title="!!user ? 'E-mailadres' : 'E-mailadres (optioneel)'" :validator="validator" placeholder="E-mailadres" :required="!!user" />
        
            <hr>
            <h2>Geef toegang tot...</h2>

            <STList>
                <STListItem element-name="label" :selectable="true" class="right-description smartphone-wrap">
                    <Checkbox slot="left" v-model="fullAccess" />
                    Maak administrator

                    <template #right>
                        Kan alle instellingen en beheerders bewerken
                    </template>
                </STListItem>
                <STListItem v-if="!fullAccess" element-name="label" :selectable="true" class="right-description smartphone-wrap">
                    <Checkbox slot="left" v-model="writeAccess" />
                    Toegang tot alle groepen

                    <template #right>
                        Kan alle leden bekijken en bewerken
                    </template>
                </STListItem>
                <template v-if="!writeAccess && !fullAccess">
                    <STListItem v-for="group in groups" :key="group.group.id" element-name="label" :selectable="true">
                        <Checkbox slot="left" v-model="group.selected" />
                        {{ group.group.settings.name }}
                    </STListItem>
                </template>
            </STList>

            <template v-if="editUser !== null">
                <hr>
                <h2>Encryptiesleutels</h2>
                <p>Alle gegevens van leden worden versleuteld met een sleutel. Die sleutel kan door de tijd gewijzigd worden door beheerders (Stamhoofd forceert dit ook jaarlijks in de achtergrond). Er is altijd maximaal één encryptiesleutel actief voor de hele vereniging tegelijkertijd. Als een lid inschrijft of gegevens wijzigt op dit moment, wordt altijd die sleutel gebruikt. Het kan dus zijn dat je wel toegang hebt tot de laatste sleutel, maar niet tot een oude sleutel waarmee een lid heeft geregistreerd. Daardoor kan je die gegevens niet raadplegen. Hieronder kan je zien tot welke sleutels deze beheerder toegang heeft, en je kan een sleutel waar jij toegang tot hebt doorsturen. Dit heb je nodig als deze beheerder zijn wachtwoord is vergeten, want dan verliest hij toegang tot alle sleutels nadat hij zijn wachtwoord heeft gereset. Stamhoofd heeft zelf nooit toegang tot sleutels en kan deze dus ook niet herstellen als ze verloren zijn.</p>

                <p v-if="!hasKey" class="warning-box">
                    {{ user.firstName }} heeft geen toegang tot de huidige sleutel. Je kan hieronder toegang geven tot de sleutel als je die zelf hebt.
                </p>

                <Spinner v-if="loadingKeys" />

                <STList>
                    <STListItem v-for="key of availableKeys" :key="key.publicKey">
                        <h2 class="style-title-list">
                            Sleutel {{ key.publicKey.substring(0, 7).toUpperCase() }}
                        </h2>
                        <p v-if="!key.end" class="style-description-small">
                            Huidige sleutel voor iedereen
                        </p>
                        <p v-else class="style-description-small">
                            Sommige leden die ingeschreven of gewijzigd zijn tussen {{ key.start | date }} en {{ key.end | date }} gebruiken deze sleutel nog
                        </p>
                        <button v-if="!key.hasAccess && canShareKey(key.publicKey)" class="button text" @click="shareKey(key.publicKey)">
                            <span class="icon privacy" />
                            <span>Toegang geven</span>
                        </button>

                        <template #right>
                            <span v-if="!key.hasAccess" v-tooltip="user.firstName+' heeft geen toegang tot deze sleutel'" class="icon error" />
                            <span v-else v-tooltip="user.firstName+' heeft toegang tot deze sleutel'" class="icon success green" />
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>

        <STToolbar>
            <template slot="right">
                <button v-if="!isNew && !user" class="button secundary" @click="resendInvite">
                    Opnieuw versturen
                </button>
                <LoadingButton :loading="saving">
                    <button v-if="isNew" class="button primary" @click="save">
                        Toevoegen
                    </button>
                    <button v-else class="button primary" @click="save">
                        Opslaan
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { ArrayDecoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, VersionBox } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, ErrorBox, LoadingButton, Spinner,STErrorsDefault,STInputBox, STList, STListItem, STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import Tooltip from '@stamhoofd/components/src/directives/Tooltip';
import { Sodium } from '@stamhoofd/crypto';
import { Keychain,SessionManager } from '@stamhoofd/networking';
import { Group, GroupPermissions, Invite, InviteKeychainItem, InviteUserDetails, KeychainedResponseDecoder,NewInvite, OrganizationKeyUser, PermissionLevel, Permissions, User, Version } from "@stamhoofd/structures"
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import SendInviteView from './SendInviteView.vue';

class SelectableGroup {
    group: Group;
    selected = false
    constructor(group: Group, selected = false) {
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
        STListItem,
        Spinner
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

    forceCreate = false

    loadingKeys = false
    availableKeys: OrganizationKeyUser[] = []

    get isNew() {
        return this.forceCreate || (!this.editInvite && !this.editUser)
    }

    get organization() {
        return OrganizationManager.organization
    }

    get hasKey() {
        if (this.loadingKeys) {
            return true
        }

        return !!this.availableKeys.find(f => f.publicKey == this.organization.publicKey && f.hasAccess)
    }

    canShareKey(key: string) {
        return !!Keychain.getItem(key)
    }

    async shareKey(key: string) {
        if (this.saving) {
            return;
        }

        const item = Keychain.getItem(key)
        if (!item) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Je hebt zelf geen toegang tot deze sleutel. Vraag aan een andere beheerder die wel toegang heeft tot deze sleutel om toegang te verlenen."
            }))
            return
        }
        console.log(item)
        let keyPair: {
            publicKey: string;
            privateKey: string;
        } | undefined = undefined
        try {
            keyPair = await SessionManager.currentSession!.decryptKeychainItem(item)
        } catch (e) {
            console.log(e)
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Je hebt zelf geen toegang tot deze sleutel. Vraag aan een andere beheerder die wel toegang heeft tot deze sleutel om toegang te verlenen."
            }))
            return
        }

        if (!this.editUser || !this.editUser.publicKey) {
            this.errorBox = new ErrorBox(new SimpleError({
                code: "",
                message: "Deze gebruiker heeft nog nooit ingelogd en nog nooit een wachtwoord ingesteld. We kunnen op geen enkele manier de sleutel delen. Vraag aan deze gebruiker om zich te registereren met dit e-mailadres en probeer daarna opnieuw."
            }))
            return
        }

        // Create an invite (automatic one)
        const items = new VersionBox([InviteKeychainItem.create({
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey
        })])

        this.saving = true

        const invite = NewInvite.create({ 
            userDetails: null,
            permissions: null,
            receiverId: this.editUser.id,
            keychainItems: await Sodium.sealMessage(JSON.stringify(items.encode({ version: Version })), this.editUser.publicKey)
        })

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/invite",
                body: invite,
                decoder: Invite as Decoder<Invite>
            })

            new Toast("Als "+this.editUser.firstName+" nu inlogt (voor "+Formatter.date(response.data.validUntil)+") in Stamhoofd krijgt hij/zij automatisch toegang tot deze sleutel.", "success green").setHide(7000).show()
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }

    mounted() {
        for (const group of this.organization.groups) {
            
            this.groups.push(new SelectableGroup(group, (this.user ?? this.invite).permissions?.hasWriteAccess(group.id) ?? false))
        }

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

                if (this.onUpdateInvite) {
                    this.onUpdateInvite(response.data);
                }

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

    async deleteMe(force = false) {
        if (this.deleting || this.saving) {
            return false;
        }
        
        if (this.isNew) {
            return false;
        }

        if (!force && !confirm("Ben je zeker dat je deze beheerder wilt verwijderen?")) {
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

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
