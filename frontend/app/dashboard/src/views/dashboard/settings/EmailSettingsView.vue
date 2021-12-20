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

            <p>Wijzig de e-mailadressen waarmee je e-mails kan versturen. Alle informatie over e-mailadressen en e-mails vind je op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/emails-versturen'" target="_blank">deze pagina</a>.</p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" @click="editEmail(email)">
                    <h3 class="style-title-list">
                        {{ email.name ? email.name : email.email }}
                    </h3>
                    <p v-if="email.name" class="style-description-small">
                        {{ email.email }}
                    </p>

                    <span v-if="email.default" slot="right" class="style-tag">Standaard</span>

                    <span slot="right" class="icon arrow-right-small gray" />
                </STListItem>
            </STList>

            <p v-if="emails.length == 0" class="info-box">
                Je hebt nog geen e-mailadressen toegevoegd. 
            </p>
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
        this.show(new ComponentWithProperties(EditEmailView, { emailId: email.id }))
    }
    
    addEmail() {
        const email = OrganizationEmail.create({ email: "" })
        const patch = OrganizationManager.getPatch()
        patch.privateMeta = OrganizationPrivateMetaData.patchType().create({})
        patch.privateMeta!.emails.addPut(email)
        this.show(new ComponentWithProperties(EditEmailView, { initialPatch: patch, emailId: email.id, isNew: true }))
    }
}
</script>
