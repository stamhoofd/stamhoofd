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
                        <input v-model="invite.userDetails.firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                    </div>
                    <div>
                        <input v-model="invite.userDetails.lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                    </div>
                </div>
            </STInputBox>

            <EmailInput title="E-mailadres (optioneel)" :validator="validator" v-model="invite.userDetails.email" placeholder="E-mailadres" :required="false"/>
        
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
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord, OrganizationEmail, OrganizationPrivateMetaData, Version, GroupPrivateSettingsPatch, NewInvite, InviteUserDetails, Permissions, PermissionLevel, GroupPermissions, Invite, InviteKeychainItem } from "@stamhoofd/structures"
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

    invite = NewInvite.create({ userDetails: InviteUserDetails.create({}) })

    groups: SelectableGroup[] = []
    fullAccess = false
    writeAccess = false

    get isNew() {
        return true
    }

    get organization() {
        return OrganizationManager.organization
    }

    mounted() {
        for (const group of this.organization.groups) {
            this.groups.push(new SelectableGroup(group, false))
        }
    }
   
    async deleteMe() {
        if (this.saving) {
            return;
        }

        if (!confirm("Ben je zeker dat je deze beheerder wilt verwijderen?")) {
            return;
        }

        /*const patch = OrganizationPatch.create({}).patch(this.organizationPatch)

        if (!patch.privateMeta) {
            patch.privateMeta = OrganizationPrivateMetaData.patchType().create({})
        }

        patch.privateMeta!.emails.addDelete(this.emailId)

        patch.groups = new PatchableArray()

        for (const group of this.groups) {
            // Check if changed
            const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === this.emailId
            if (prev) {
                patch.groups.addPatch(GroupPatch.create({
                    id: group.group.id,
                    privateSettings: GroupPrivateSettingsPatch.create({
                        defaultEmailId: null,
                    })
                }))
            }
        }

        this.saving = true

        try {
            await OrganizationManager.patch(patch)
            this.pop({ force: true })
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }*/
    }
   
    async save() {
        if (this.saving) {
            return;
        }

        this.saving = true

        const errors = new SimpleErrors()
        
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
        this.invite.permissions = permissions

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

        this.invite.keychainItems = await Sodium.encryptMessage(JSON.stringify(items.encode({ version: Version })), secret)

        try {
            const response = await SessionManager.currentSession!.authenticatedServer.request({
                method: "POST",
                path: "/invite",
                body: this.invite,
                decoder: Invite as Decoder<Invite>
            })

            this.show(new ComponentWithProperties(SendInviteView, { secret, invite: response.data }))
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }


}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

</style>
