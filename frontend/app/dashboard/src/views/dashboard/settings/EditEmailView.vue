<template>
    <SaveView :loading="saving" title="E-mailadres" :disabled="!hasChanges" @save="save">
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

        <Checkbox v-model="isDefault">
            <h3 class="style-title-list">
                Standaard e-mailadres
            </h3>
            <p class="style-description-small">
                Voor algemene e-mails of voor antwoorden op automatische e-mails als domeinnaam niet ingesteld is (bv. als antwoord op bestelbevestiging).
            </p>
        </Checkbox>

        <template v-if="enableMemberModule">
            <hr>
            <h2>Inschrijvingsgroepen</h2>
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
            </STList>
        </template>

        <template v-if="enableWebshopModule">
            <hr>
            <h2>Webshops</h2>
            <p class="st-list-description">
                Selecteer de webshops waarvoor we dit e-mailadres moeten gebruiken (bv. bestelbevestiging).
            </p>

            <STList>
                <STListItem v-for="webshop in webshops" :key="webshop.webshop.id" element-name="label" :selectable="true">
                    <Checkbox slot="left" v-model="webshop.selected" />
                    <h3 class="style-title-list">
                        {{ webshop.webshop.meta.name }}<h3 />
                    </h3>
                </STListItem>
            </STList>
        </template>

        <div v-if="!isNew" class="container">
            <hr>
            <h2>
                Verwijderen
            </h2>

            <button class="button secundary danger" type="button" @click="deleteMe">
                <span class="icon trash" />
                <span>Verwijderen</span>
            </button>
        </div>
    </SaveView>
</template>

<script lang="ts">
import { AutoEncoderPatchType, isPatchable, PartialWithoutMethods, PatchableArray, PatchableArrayAutoEncoder, patchContainsChanges } from '@simonbackx/simple-encoding';
import { SimpleErrors } from '@simonbackx/simple-errors';
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, Checkbox, EmailInput, ErrorBox, SaveView, STErrorsDefault, STInputBox, STList, STListItem, Toast, Validator } from "@stamhoofd/components";
import { Group, GroupPatch, GroupPrivateSettingsPatch, Organization, OrganizationEmail, OrganizationPatch, OrganizationPrivateMetaData, Version, WebshopPreview, WebshopPrivateMetaData } from "@stamhoofd/structures";
import { Component, Mixins, Prop } from "vue-property-decorator";



class SelectableGroup {
    group: Group;
    selected = false;
    constructor(group: Group, selected = false) {
        this.selected = selected
        this.group = group
    }
}

class SelectableWebshop {
    webshop: WebshopPreview;
    selected = false;
    constructor(webshop: WebshopPreview, selected = false) {
        this.selected = selected
        this.webshop = webshop
    }
}

@Component({
    components: {
        STInputBox,
        STErrorsDefault,
        Checkbox,
        EmailInput,
        STList,
        STListItem,
        SaveView
    }
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
    
    organizationPatch = this.initialPatch ? this.initialPatch : this.$organizationManager.getPatch()

    groups: SelectableGroup[] = []
    webshops: SelectableWebshop[] = []


    get organization() {
        return this.$organization.patch(this.organizationPatch)
    }

    get enableMemberModule() {
        return this.organization.meta.modules.useMembers
    }

    get enableWebshopModule() {
        return this.organization.meta.modules.useWebshops
    }

    mounted() {
        for (const group of this.organization.groups) {
            this.groups.push(new SelectableGroup(group, group.privateSettings !== null && group.privateSettings.defaultEmailId !== null && group.privateSettings.defaultEmailId === this.emailId))
        }

        for (const webshop of this.organization.webshops) {
            this.webshops.push(new SelectableWebshop(webshop, webshop.privateMeta !== null && webshop.privateMeta.defaultEmailId !== null && webshop.privateMeta.defaultEmailId === this.emailId))
        }
    }

    get unpatchedOrganizationEmail(): OrganizationEmail | null {
        const organization = this.$organization
        for (const email of organization.privateMeta?.emails ?? []) {
            if (email.id === this.emailId) {
                return email
            }
        }
        if (this.saving) {
            return OrganizationEmail.create({ email: "" })
        }
        return null;
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
                this.organizationPatch.privateMeta!.emails = (emails as PatchableArrayAutoEncoder<OrganizationEmail>).filter(this.emailId)
            }
        }
    }

    async deleteMe() {
        if (this.saving) {
            return;
        }

        if (!await CenteredMessage.confirm("Ben je zeker dat je dit e-mailadres wilt verwijderen?", "Verwijderen")) {
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
            await this.$organizationManager.patch(patch)
            this.pop({ force: true })
            this.saving = false
        } catch (e) {
            console.error(e)
            this.errorBox = new ErrorBox(e)
            this.saving = false
        }
    }

    get hasChanges() {
        for (const group of this.groups) {
            // Check if changed
            const prev = group.group.privateSettings !== null && group.group.privateSettings.defaultEmailId !== null && group.group.privateSettings.defaultEmailId === this.emailId
            if (prev != group.selected) {
                return true
            }
        }

        for (const webshop of this.webshops) {
            // Check if changed
            const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === this.emailId
            if (prev != webshop.selected) {
                return true
            }
        }

        return patchContainsChanges(this.organizationPatch, this.initialPatch ? this.$organization.patch(this.initialPatch) : this.$organization, { version: Version })
    }

    async shouldNavigateAway() {
        if (!this.hasChanges) {
            return true;
        }
        return await CenteredMessage.confirm("Ben je zeker dat je wilt sluiten zonder op te slaan?", "Niet opslaan")
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

        for (const webshop of this.webshops) {
            // Check if changed
            const prev = webshop.webshop.privateMeta !== null && webshop.webshop.privateMeta.defaultEmailId !== null && webshop.webshop.privateMeta.defaultEmailId === this.emailId
            if (prev != webshop.selected) {
                this.organizationPatch.webshops.addPatch(WebshopPreview.patch({
                    id: webshop.webshop.id,
                    privateMeta: WebshopPrivateMetaData.patch({
                        defaultEmailId: webshop.selected ? this.emailId : null,
                    })
                }))
            }
        }

        if (!valid) {
            return;
        }

        this.saving = true

        try {
            await this.$organizationManager.patch(this.organizationPatch)
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