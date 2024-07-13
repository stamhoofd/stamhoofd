<template>
    <div class="st-view">
        <STNavigationBar title="E-mailadressen" />

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

                    <template #right>
                        <span v-if="email.default" class="style-tag">Standaard</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
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

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from "@simonbackx/vue-app-navigation";
import { STList, STListItem, STNavigationBar, STToolbar, useOrganization, usePlatform } from "@stamhoofd/components";
import { OrganizationEmail } from "@stamhoofd/structures";


import { computed } from "vue";
import EditEmailView from './EditEmailView.vue';

const organization = useOrganization()
const platform = usePlatform()
const emails = computed(() => (organization.value ? organization.value.privateMeta?.emails : platform.value.privateConfig?.emails) ?? [])

const present = usePresent()

async function editEmail(email: OrganizationEmail) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailView, {
                email,
                isNew: false
            })
        ],
        modalDisplayStyle: 'popup'
    })
}

async function addEmail() {
    const email = OrganizationEmail.create({ email: "" })
    await present({
        components: [
            new ComponentWithProperties(EditEmailView, {
                email,
                isNew: true
            })
        ],
        modalDisplayStyle: 'popup'
    })
}
</script>
