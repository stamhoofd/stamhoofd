<template>
    <SaveView :title="$t('%Zu2')" :loading="saving" :save-text="$t('%Zve')" data-testid="mailchimp-api-key-view" @save="save">
        <h1>{{ $t('%Zwu') }}</h1>
        <p>{{ $t('%Zvz') }}</p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <PasswordInput
            v-model="apiKey"
            error-fields="apiKey"
            :error-box="errors.errorBox"
            :title="$t('%Zu2')"
            :placeholder="settings ? $t('%ZwD') : $t('%ZuL')"
            autocomplete="off"
            :show-text="$t('%Zwy')"
            :hide-text="$t('%1Ys')"
        />
    </SaveView>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { MailchimpConnectRequest } from '@stamhoofd/structures/mailchimp/MailchimpConnectRequest.js';
import { MailchimpSettings } from '@stamhoofd/structures/mailchimp/MailchimpSettings.js';
import { ref } from 'vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import PasswordInput from '#inputs/PasswordInput.vue';
import SaveView from '#navigation/SaveView.vue';
import { Toast } from '#overlays/Toast.ts';
import { useMailchimpSettings } from './useMailchimp.ts';

const pop = usePop();
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();
const { settings, setSettings } = useMailchimpSettings();

const apiKey = ref('');
const saving = ref(false);

async function save() {
    if (saving.value) {
        return;
    }
    errors.errorBox = null;

    if (!apiKey.value.trim()) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_field',
            message: 'API key is required',
            human: $t('%Zvk'),
            field: 'apiKey',
        }));
        return;
    }

    saving.value = true;
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/mailchimp/connect',
            body: MailchimpConnectRequest.create({ apiKey: apiKey.value.trim() }),
            decoder: MailchimpSettings as Decoder<MailchimpSettings>,
            owner,
            shouldRetry: false,
        });
        setSettings(response.data);
        Toast.success($t('%ZvX')).show();
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    saving.value = false;
}
</script>
