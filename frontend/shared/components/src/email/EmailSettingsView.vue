<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`1363c0ee-0f4b-43f8-a9ee-a2a6091e5d96`)" />

        <main>
            <h1>
                {{ $t('Afzenders') }}
            </h1>

            <p>{{ $t('ecc5560e-bd85-4f2a-bbb2-d0a26f8ead45') }} <a class="inline-link" :href="$domains.getDocs('e-mailadressen-instellen')" target="_blank">{{ $t('3280290b-f43e-4e95-a7bd-3c13a153888b') }}</a>.</p>

            <STList>
                <STListItem v-for="email in emails" :key="email.id" :selectable="true" class="right-stack" @click="editEmail(email)">
                    <template #left>
                        <IconContainer icon="email-filled" class="" />
                    </template>

                    <h3 class="style-title-list">
                        {{ email.name ? email.name : email.email }}
                    </h3>
                    <p v-if="email.name" class="style-description-small">
                        {{ email.email }}
                    </p>

                    <template #right>
                        <span v-if="email.default" class="style-tag">{{ $t('b67ee618-6873-4dfe-84b6-faa51f37d661') }}</span>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>

            <p v-if="emails.length === 0" class="info-box">
                {{ $t('82395203-b523-4188-b304-0b07aea519cf') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="addEmail">
                    <span class="icon add" />
                    <span>{{ $t('c5602934-95a8-437d-b576-eda8d9e6565e') }}</span>
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { IconContainer, STList, STListItem, STNavigationBar, STToolbar, useOrganization, usePlatform } from '@stamhoofd/components';
import { OrganizationEmail } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditEmailView from './EditEmailView.vue';

const organization = useOrganization();
const platform = usePlatform();
const emails = computed(() => (organization.value ? organization.value.privateMeta?.emails : platform.value.privateConfig?.emails) ?? []);

const present = usePresent();

async function editEmail(email: OrganizationEmail) {
    await present({
        components: [
            new ComponentWithProperties(EditEmailView, {
                email,
                isNew: false,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function addEmail() {
    const email = OrganizationEmail.create({ email: '' });
    await present({
        components: [
            new ComponentWithProperties(EditEmailView, {
                email,
                isNew: true,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
