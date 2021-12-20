<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadres">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!isNew" slot="right" class="button text" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </STNavigationBar>

        <main>
            <h1 v-if="isNew">
                E-mailadres toevoegen
            </h1>
            <h1 v-else>
                E-mailadres bewerken
            </h1>

            <STErrorsDefault :error-box="errorBox" />
            <STInputBox title="Naam / aanspreking (optioneel)" error-fields="name" :error-box="errorBox">
                <input
                    ref="firstInput"
                    v-model="name"
                    class="input"
                    type="text"
                    placeholder="Optioneel. bv. Webshopverantwoordelijke"
                    autocomplete=""
                >
            </STInputBox>

            <EmailInput v-model="email" title="E-mailadres" :validator="validator" placeholder="E-mailadres waarmee je wilt versturen" />

            <template v-if="enableMemberModule">
                <hr>
                <h2>Standaard e-mailadres voor...</h2>
                <p class="st-list-description">
                    Selecteer de groepen die standaard met dit e-mailadres moeten versturen.
                </p>

                <STList>
                    <STListItem v-for="group in groups" :key="group.group.id" element-name="label" :selectable="true">
                        <Checkbox slot="left" v-model="group.selected" />
                        <h3 class="style-title-list">
                            {{ group.group.settings.name }}<h3 />
                        </h3>
                    </STListItem>
                    <STListItem element-name="label" :selectable="true">
                        <Checkbox slot="left" v-model="isDefault" />
                        <h3 class="style-title-list">
                            Standaard e-mails
                        </h3>
                        <p class="style-description-small">
                            Voor andere e-mails of voor binnenkomende e-mails van leden die (onbewust) naar een no-reply Stamhoofd e-mailadres mailen (bv. als antwoord op een wachtwoord vergeten e-mail).
                        </p>
                    </STListItem>
                </STList>
            </template>
            <Checkbox v-else v-model="isDefault">
                <h3 class="style-title-list">
                    Standaard e-mails
                </h3>
                <p class="style-description-small">
                    Voor algemene e-mails of voor binnenkomende e-mails van leden die (onbewust) naar een no-reply Stamhoofd e-mailadres mailen (bv. als antwoord op een wachtwoord vergeten e-mail).
                </p>
            </Checkbox>
        </main>

        <STToolbar>
            <template slot="right">
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
import { ArrayDecoder, AutoEncoder, AutoEncoderPatchType, Decoder,isPatchable,PartialWithoutMethods, PatchableArray,PatchableArrayAutoEncoder,PatchType } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,EmailInput, ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem,STNavigationBar, STToolbar, Toast, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Address, DNSRecord, Group, GroupGenderType, GroupPatch, GroupPrivateSettingsPatch,GroupSettings, GroupSettingsPatch, Organization, OrganizationDomains, OrganizationEmail, OrganizationPatch, OrganizationPrivateMetaData, Version } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
import DNSRecordsView from './DNSRecordsView.vue';

class SelectableGroup {
    group: Group;
    selected = false;
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
        STListItem
    },
})
export default class EditEmailView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop()
    emailId!: string;

    @Prop({ default: false })
    isNew!: boolean;

    /**
     * Pass some patches from outside, and also save these patches when saving the e-mail (e.g. creating an email)
     */
    @Prop({ default: null })
    initialPatch!: AutoEncoderPatchType<Organization> | null;
    
    organizationPatch = this.initialPatch ? this.initialPatch : OrganizationManager.getPatch()

    groups: SelectableGroup[] = []

    OrganizationManager = OrganizationManager

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    mounted() {
        for (const group of this.organization.groups) {
            this.groups.push(new SelectableGroup(group, group.privateSettings !== null && group.privateSettings.defaultEmailId !== null && group.privateSettings.defaultEmailId === this.emailId))
        }
    }

    get unpatchedOrganizationEmail() {
        const organization = OrganizationManager.organization
        for (const email of organization.privateMeta?.emails ?? []) {
            if (email.id === this.emailId) {
                return email
            }
        }
        if (this.saving) {
            return OrganizationEmail.create({ email: "" })
        }
        throw new Error("Email not found")
    }

    get organizationEmail() {
        const organization = this.organization
        for (const email of organization.privateMeta?.emails ?? []) {
            if (email.id === this.emailId) {
                return email
            }
        }
        if (this.saving) {
            return OrganizationEmail.create({ email: "" })
        }
        throw new Error("Email not found")
    }

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationEmail>>, emailId?: string) {
        if (this.saving) {
            return
        }

        const p = OrganizationEmail.patch({ id: emailId ?? this.emailId, ...patch });
        const emails: PatchableArrayAutoEncoder<OrganizationEmail> = new PatchableArray()
        emails.addPatch(p)

        this.organizationPatch = this.organizationPatch.patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                emails
            })
        })
    }

    get email() {
        return this.organizationEmail.email
    }

    set email(email: string) {
        this.addPatch({ email: email ?? "" })
    }

    get name() {
        return this.organizationEmail.name ?? ""
    }

    set name(name: string) {
        this.addPatch({ name: name })
    }

    get isDefault() {
        return this.organizationEmail.default
    }

    set isDefault(d: boolean) {
        if (!d) {
            // Check the original value
            const unpatched = this.unpatchedOrganizationEmail
            if (unpatched && unpatched.default) {
                new Toast("Om het standaard e-mailadres te wijzigen moet je het bij een ander e-mailadres aanvinken.", "info").show()
                return
            }
        }
        this.addPatch({ default: d })

        if (d) {
            // Patch all other emails to false
            for (const email of this.organization.privateMeta?.emails ?? []) {
                if (email.id !== this.emailId) {
                    this.addPatch({ default: false }, email.id)
                }
            }
        } else {
            // Clear other patches
            const emails = this.organizationPatch.privateMeta?.emails
            if (emails && isPatchable(emails)) {
                // Keep only patches with email id
                this.organizationPatch.privateMeta!.emails = emails.filter(this.emailId)
            }
        }
    }

    async deleteMe() {
        if (this.saving) {
            return;
        }

        if (!confirm("Ben je zeker dat je dit e-mailadres wilt verwijderen?")) {
            return;
        }

        const patch = OrganizationPatch.patch(this.organizationPatch)

        if (!patch.privateMeta) {
            patch.privateMeta = OrganizationPrivateMetaData.patch({})
        }

        (patch.privateMeta! as AutoEncoderPatchType<OrganizationPrivateMetaData>).emails.addDelete(this.emailId)

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
        }
    }
   
    async save() {
        if (this.saving) {
            return;
        }

        const errors = new SimpleErrors()
        
        let valid = false

        if (errors.errors.length > 0) {
            this.errorBox = new ErrorBox(errors)
        } else {
            this.errorBox = null
            valid = true
        }
        valid = valid && await this.validator.validate()

        this.organizationPatch.groups = new PatchableArray()

        for (const group of this.groups) {
            // Check if changed
            const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === this.emailId
            if (prev != group.selected) {
                this.organizationPatch.groups.addPatch(GroupPatch.create({
                    id: group.group.id,
                    privateSettings: GroupPrivateSettingsPatch.create({
                        defaultEmailId: group.selected ? this.emailId : null,
                    })
                }))
            }
        }

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await OrganizationManager.patch(this.organizationPatch)
            this.pop({ force: true })
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }


}
</script>