<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t('cefd590d-9b21-48fc-8069-db560468e724') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <EmailInput v-for="n in emailCount" :key="n" :title="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`) + ' '+n" :model-value="getEmail(n - 1)" :validator="errors.validator" :placeholder="$t(`7400cdce-dfb4-40e7-996b-4817385be8d8`)" @update:model-value="setEmail(n - 1, $event)">
            <template #right>
                <span v-if="isBlocked(n-1)" v-tooltip="getInvalidEmailDescription(n-1)" class="icon warning yellow" />
                <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
            </template>
        </EmailInput>

        <p v-if="emailCount === 0" class="info-box">
            {{ $t('e6c3ac24-00f5-4bee-b5b6-bf12c073ff7f') }}
        </p>

        <button v-for="suggestion in suggestions" :key="suggestion" class="button text" type="button" @click="addEmail(suggestion)">
            <span class="icon add" />
            <span>{{ suggestion }}</span>
        </button>

        <button class="button text" type="button" @click="addEmail('')">
            <span class="icon add" />
            <span>{{ $t('31738583-bdca-42de-9698-1c11f9deac7e') }}</span>
        </button>
    </SaveView>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { EmailInput, SaveView, STErrorsDefault, useContext } from '@stamhoofd/components';
import { EmailInformation, PrivateWebshop, WebshopPrivateMetaData } from '@stamhoofd/structures';

import { useOrganizationManager } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();
const viewTitle = 'Meldingen';

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});
const context = useContext();
const organizationManager = useOrganizationManager();

const user = computed(() => organizationManager.value.user);

const emails = computed(() => webshop.value.privateMeta.notificationEmails);

function getEmail(n: number) {
    return emails.value[n];
}

onMounted(() => {
    checkBounces().catch(console.error);
});

function setEmail(n: number, email: string) {
    const notificationEmails = emails.value.slice();
    notificationEmails[n] = email;
    addPatch(PrivateWebshop.patch({
        privateMeta: WebshopPrivateMetaData.patch({
            notificationEmails: notificationEmails as any,
        }),
    }));
}

function deleteEmail(n: number) {
    const notificationEmails = emails.value.slice();
    notificationEmails.splice(n, 1);
    addPatch(PrivateWebshop.patch({
        privateMeta: WebshopPrivateMetaData.patch({
            notificationEmails: notificationEmails as any,
        }),
    }));
}

function addEmail(str: string) {
    const notificationEmails = emails.value.slice();
    notificationEmails.push(str);
    addPatch(PrivateWebshop.patch({
        privateMeta: WebshopPrivateMetaData.patch({
            notificationEmails: notificationEmails as any,
        }),
    }));
}

function isBlocked(n: number) {
    const email = getEmail(n);
    return emailInformation.value.find(e => e.email === email && (e.markedAsSpam || e.hardBounce || e.unsubscribedAll));
}

function getInvalidEmailDescription(n: number) {
    const email = getEmail(n);
    const find = emailInformation.value.find(e => e.email === email);
    if (!find) {
        return null;
    }
    if (find.unsubscribedAll) {
        return 'Heeft zich uitgeschreven voor e-mails';
    }
    if (find.markedAsSpam) {
        return 'Heeft e-mail als spam gemarkeerd';
    }
    if (find.hardBounce) {
        return 'Ongeldig e-mailadres';
    }
    return null;
}

const checkingBounces = ref(false);
const emailInformation = ref<EmailInformation[]>([]);

async function checkBounces() {
    if (checkingBounces.value) {
        return;
    }
    checkingBounces.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/email/check-bounces',
            body: emails.value,
            decoder: new ArrayDecoder(EmailInformation as Decoder<EmailInformation>),
        });
        emailInformation.value = response.data;
    }
    catch (e) {
        console.error(e);
    }
    checkingBounces.value = false;
}

const suggestions = computed(() => [user.value.email].filter(e => !emails.value.includes(e)));
const emailCount = computed(() => emails.value.length);

defineExpose({
    shouldNavigateAway,
});
</script>
