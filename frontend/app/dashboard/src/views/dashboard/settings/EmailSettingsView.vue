<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadressen">
            <BackButton slot="left" v-if="canPop" @click="pop"/>
            <button slot="right" class="button icon close gray" v-if="!canPop && canDismiss" @click="dismiss"/>
        </STNavigationBar>

        <main>
            <h1>
                E-mailadressen
            </h1>
        
             <p class="st-list-description" v-if="organization.privateMeta && organization.privateMeta.mailDomainActive">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt die eindigen op @{{ organization.privateMeta.mailDomain }}, kan je e-mails versturen vanaf dat e-mailadres. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres, de e-mail wordt nog steeds verstuurd vanaf @{{ organization.privateMeta.mailDomain }}. Voeg enkel e-mailadressen toe waar je ook e-mails kan op ontvangen.
            </p>
            <p class="st-list-description" v-else>
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt met jouw eigen domeinnaam (bv. info@mijnvereniging.be), kan je e-mails versturen vanaf dat e-mailadres als je jouw domeinnaam eerst toevoegt (kan bij instellingen). Andere e-mails worden vanaf @stamhoofd.email verstuurd.
                Voeg enkel e-mailadressen toe waarop je e-mails kan ontvangen.
            </p>

            <STList>
                <STListItem :selectable="true" v-for="email in emails" :key="email.id" @click="editEmail(email)">
                    {{ email.name ? email.name+" <"+email.email+">" : email.email }}

                    <span slot="right" class="icon arrow-right-small gray"/>
                </STListItem>
            </STList>

        </main>

        <STToolbar>
            <template slot="right">
                <button class="button primary" @click="addEmail">
                    <span class="icon add" />
                    <span>E-mailadres toevoegen</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { AutoEncoder, AutoEncoderPatchType, Decoder,PartialWithoutMethods, PatchType, ArrayDecoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { ErrorBox, BackButton, Checkbox,STErrorsDefault,STInputBox, STNavigationBar, STToolbar, LoadingButton, Validator, STList, STListItem } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { Group, GroupGenderType, GroupPatch, GroupSettings, GroupSettingsPatch, Organization, OrganizationPatch, Address, OrganizationDomains, DNSRecord, OrganizationEmail, OrganizationPrivateMetaData } from "@stamhoofd/structures"
import { Component, Mixins,Prop } from "vue-property-decorator";
import { OrganizationManager } from "../../../classes/OrganizationManager"
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import DNSRecordsView from './DNSRecordsView.vue';
import EditEmailView from './EditEmailView.vue';

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STInputBox,
        STErrorsDefault,
        Checkbox,
        BackButton,
        LoadingButton,
        STList,
        STListItem
    },
})
export default class EmailSettingsView extends Mixins(NavigationMixin) {
    errorBox: ErrorBox | null = null
    validator = new Validator()
    saving = false

    // Make session (organization) reactive
    reactiveSession = SessionManager.currentSession

    get organization() {
        return OrganizationManager.organization
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    editEmail(email: OrganizationEmail) {
        const patch = OrganizationManager.getPatch()
        this.show(new ComponentWithProperties(EditEmailView, { organizationPatch: patch, emailId: email.id }))
    }
    
    addEmail() {
        const email = OrganizationEmail.create({ email: "" })
        const patch = OrganizationManager.getPatch()
        patch.privateMeta = OrganizationPrivateMetaData.patchType().create({})
        patch.privateMeta!.emails.addPut(email)
        this.show(new ComponentWithProperties(EditEmailView, { organizationPatch: patch, emailId: email.id }))
    }
}
</script>
