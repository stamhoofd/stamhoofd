<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadressen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                E-mailadressen
            </h1>

            <p>Wijzig de e-mailadressen waarmee je e-mails kan versturen. Alle informatie over e-mailadressen en e-mails vind je op <a class="inline-link" :href="'https://'+$t('shared.domains.marketing')+'/docs/e-mailadressen-instellen/'" target="_blank">deze pagina</a>.</p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" class="right-stack" @click="editEmail(email)">
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
            <template #right>
                <button class="button primary" type="button" @click="addEmail">
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
    reactiveSession = this.$context

    get organization() {
        return this.$organization
    }

    get emails() {
        return this.organization.privateMeta?.emails ?? []
    }

    editEmail(email: OrganizationEmail) {
        this.present(new ComponentWithProperties(EditEmailView, { emailId: email.id }).setDisplayStyle('popup'))
    }
    
    addEmail() {
        const email = OrganizationEmail.create({ email: "" })
        const patch = this.$organizationManager.getPatch()
        patch.privateMeta = OrganizationPrivateMetaData.patchType().create({})
        patch.privateMeta!.emails.addPut(email)
        this.present(new ComponentWithProperties(EditEmailView, { initialPatch: patch, emailId: email.id, isNew: true }).setDisplayStyle('popup'))
    }
}
</script>
