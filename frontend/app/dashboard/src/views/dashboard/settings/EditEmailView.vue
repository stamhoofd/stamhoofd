<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadres">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button class="button text" slot="right" v-if="!isNew" @click="deleteMe">
                <span class="icon trash"/>
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
                    placeholder="Optioneel. bv. Kapoenleiding"
                    autocomplete=""
                >
            </STInputBox>

            <EmailInput title="E-mailadres" :validator="validator" v-model="email" placeholder="E-mailadres waarmee je wilt versturen"/>
        
            <hr>
            <h2>Standaard e-mailadres voor...</h2>
            <p class="st-list-description">Selecteer de groepen die standaard met dit e-mailadres moeten versturen.</p>

            <STList>
                <STListItem element-name="label" :selectable="true" v-for="group in groups" :key="group.group.id">
                    <Checkbox slot="left" v-model="group.selected"/>
                    {{ group.group.settings.name }}
                </STListItem>
                <STListItem element-name="label" :selectable="true">
                    <Checkbox slot="left" v-model="isDefault"/>
                    Algemene e-mails
                </STListItem>
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
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, Validator, EmailInput, STList, STListItem } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord, OrganizationEmail, OrganizationPrivateMetaData, Version, GroupPrivateSettingsPatch } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsView from './DNSRecordsView.vue';

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
export default class EditEmailView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    @Prop()
    emailId!: string;

    @Prop()
    organizationPatch!: AutoEncoderPatchType<Organization> & AutoEncoder ;

    groups: SelectableGroup[] = []

    get privateMetaPatch() {
        return this.organizationPatch.privateMeta as AutoEncoderPatchType<OrganizationPrivateMetaData> | undefined
    }

    get isNew() {
        return this.privateMetaPatch && this.privateMetaPatch.emails.getPuts().length > 0
    }

    get organization() {
        return OrganizationManager.organization.patch(this.organizationPatch)
    }

    mounted() {
        for (const group of this.organization.groups) {
            this.groups.push(new SelectableGroup(group, group.privateSettings !== null && group.privateSettings.defaultEmailId !== null && group.privateSettings.defaultEmailId === this.emailId))
        }
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

    addPatch(patch: PartialWithoutMethods<AutoEncoderPatchType<OrganizationEmail>> ) {
        if (this.saving) {
            return
        }
        if (!(this.organizationPatch as any).privateMeta) {
            (this.organizationPatch as any).privateMeta = OrganizationPrivateMetaData.patchType().create({})
        }
        const p = OrganizationEmail.patchType().create(Object.assign(patch, { id: this.emailId }));
        (this.organizationPatch as any).privateMeta.emails.addPatch(p)
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
        this.addPatch({ default: d })
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