<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadressen">
            <BackButton v-if="canPop" slot="left" @click="pop" />
            <button v-if="!canPop && canDismiss" slot="right" class="button icon close gray" @click="dismiss" />
        </STNavigationBar>

        <main>
            <h1>
                E-mailadressen
            </h1>

            <p>Alle informatie over e-mailadressen en e-mails vind je op <a class="inline-link" href="https://www.stamhoofd.be/docs/emails-versturen" target="_blank">deze pagina</a>.</p>

        
            <p v-if="organization.privateMeta && organization.privateMeta.mailDomainActive" class="st-list-description">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt die eindigen op @{{ organization.privateMeta.mailDomain }}, kan je e-mails versturen vanaf dat e-mailadres. Bij andere e-mailadressen (bv. {{ organization.uri }}@gmail.com) kunnen we enkel instellen dat leden antwoorden naar dat e-mailadres; de e-mail wordt nog steeds verstuurd vanaf @{{ organization.privateMeta.mailDomain }}. Voeg enkel e-mailadressen toe waar je ook e-mails op kan ontvangen.
            </p>
            <p v-else class="st-list-description">
                Voeg hier de e-mailadressen van jouw vereniging toe. Als je e-mailadressen hebt met jouw eigen domeinnaam (bv. info@mijnvereniging.be), kan je e-mails versturen vanaf dat e-mailadres als je jouw domeinnaam eerst toevoegt (kan bij instellingen). Andere e-mails worden vanaf @stamhoofd.email verstuurd.
                Voeg enkel e-mailadressen toe waar je e-mails op kan ontvangen.
            </p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" @click="editEmail(email)">
                    {{ email.name ? email.name+" <"+email.email+">" : email.email }}

                    <span slot="right" class="icon arrow-right-small gray" />
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
import { ComponentWithProperties, NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton, Checkbox,ErrorBox, LoadingButton, STErrorsDefault,STInputBox, STList, STListItem,STNavigationBar, STToolbar, Validator } from "@stamhoofd/components";
import { SessionManager } from '@stamhoofd/networking';
import { OrganizationEmail, OrganizationPrivateMetaData } from "@stamhoofd/structures"
import { Component, Mixins } from "vue-property-decorator";

import { OrganizationManager } from "../../../classes/OrganizationManager"
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
