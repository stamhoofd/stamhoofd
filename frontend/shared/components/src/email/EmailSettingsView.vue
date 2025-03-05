<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`E-mailadressen`)"/>

        <main>
            <h1>
                {{ $t('94a15216-0f44-457e-83a7-0052c1526a01') }}
            </h1>

            <p>{{ $t('1ce9e0f3-d682-42a9-9280-7587b1c36e9d') }} <a class="inline-link" :href="$domains.getDocs('e-mailadressen-instellen')" target="_blank">{{ $t('7fd04b13-e600-49b1-bafb-e4f642154bcd') }}</a>.</p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" class="right-stack" @click="editEmail(email)">
                    <h3 class="style-title-list">
                        {{ email.name ? email.name : email.email }}
                    </h3>
                    <p v-if="email.name" class="style-description-small">
                        {{ email.email }}
                    </p>

                    <template #right>
                        <span v-if="email.default" class="style-tag">{{ $t('fe31f384-8acb-49db-95a5-d5a882a84b13') }}</span>
                        <span class="icon arrow-right-small gray"/>
                    </template>
                </STListItem>
            </STList>

            <p v-if="emails.length === 0" class="info-box">
                {{ $t('f42341e8-9ffe-4a18-a8c8-4238c8b807c0') }} 
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="addEmail">
                    <span class="icon add"/>
                    <span>{{ $t('7b7b7b9e-ec24-4e5d-920d-1ac8b4e05e81') }}</span>
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
