<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t('%RF') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <EmailInput v-for="n in emailCount" :key="n" :title="$t(`%1FK`) + ' '+n" :model-value="getEmail(n - 1)" :validator="errors.validator" :placeholder="$t(`%1FK`)" @update:model-value="setEmail(n - 1, $event ?? '')">
            <template #right>
                <EmailAddressWarning :email="getEmail(n-1)" />
                <button class="button icon trash gray" type="button" @click="deleteEmail(n - 1)" />
            </template>
        </EmailInput>

        <p v-if="emailCount === 0" class="info-box">
            {{ $t('%RG') }}
        </p>

        <button v-for="suggestion in suggestions" :key="suggestion" class="button text" type="button" @click="addEmail(suggestion)">
            <span class="icon add" />
            <span>{{ suggestion }}</span>
        </button>

        <button class="button text" type="button" @click="addEmail('')">
            <span class="icon add" />
            <span>{{ $t('%RH') }}</span>
        </button>
    </SaveView>
</template>

<script lang="ts" setup>
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import EmailInput from '@stamhoofd/components/inputs/EmailInput.vue';
import SaveView from '@stamhoofd/components/navigation/SaveView.vue';
import { PrivateWebshop, WebshopPrivateMetaData } from '@stamhoofd/structures';

import EmailAddressWarning from '@stamhoofd/components/email/EmailAddressWarning.vue';
import { useOrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import { computed } from 'vue';
import type { UseEditWebshopProps } from './useEditWebshop';
import { useEditWebshop } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();
const viewTitle = 'Meldingen';

const { webshop, addPatch, errors, saving, save, hasChanges, shouldNavigateAway } = useEditWebshop({
    getProps: () => props,
});
const organizationManager = useOrganizationManager();

const user = computed(() => organizationManager.value.user);

const emails = computed(() => webshop.value.privateMeta.notificationEmails);

function getEmail(n: number) {
    return emails.value[n];
}

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

const suggestions = computed(() => [user.value.email].filter(e => !emails.value.includes(e)));
const emailCount = computed(() => emails.value.length);

defineExpose({
    shouldNavigateAway,
});
</script>
