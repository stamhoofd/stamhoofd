<template>
    <SaveView :loading-view="loading" :error-box="errors.errorBox" :title="$t(`Inloggen als gebruiker`)" :disabled="!link" :save-text="$t(`Link kopiëren`)" save-icon="copy" data-testid="impersonation-link-view" @save="copy">
        <h1>{{ $t('Inloggen als {name}', {name: userName}) }}</h1>
        <p>{{ $t('Met deze link bekijk je Stamhoofd zoals deze gebruiker het ziet. Om veiligheidsredenen kan het soms zijn dat bepaalde dingen er toch een klein beetje anders uitzien. Alles wat je wijzigt, wordt geregistreerd onder jouw eigen naam.') }}</p>

        <p class="warning-box">
            {{ $t('Open deze link alleen in een privévenster (incognito). Je kan deze link niet delen met andere personen.') }}
        </p>

        <p class="warning-box">
            {{ $t('Inschrijvingen maken, mails versturen en andere acties of wijzigingen kan je niet uitvoeren als je bent ingelogd als een andere gebruiker.') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="link">
            <STInputBox :title="$t(`Link`)" error-fields="link" :error-box="errors.errorBox" class="max">
                <input v-copyable class="input" type="text" :value="link" readonly data-testid="impersonation-link">
            </STInputBox>

            <p class="style-description-small">
                {{ $t('Deze link vervalt {time} en kan maar één keer gebruikt worden, enkel vanaf dit toestel.', {time: validUntilText}) }}
            </p>
        </template>
    </SaveView>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { getAppHost, ImpersonationTicket, StartImpersonationRequest } from '@stamhoofd/structures';
import type { User } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';

import { ErrorBox } from '#errors/ErrorBox.ts';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import STInputBox from '#inputs/STInputBox.vue';
import SaveView from '#navigation/SaveView.vue';
import { Toast } from '#overlays/Toast.ts';

const props = defineProps<{
    user: User;
}>();

const $context = useContext();
const organization = useOrganization();
const errors = useErrors();
const loading = ref(true);
const link = ref('');
const validUntil = ref<Date | null>(null);

const userName = computed(() => props.user.name || props.user.email);
const validUntilText = computed(() => validUntil.value ? Formatter.time(validUntil.value) : '');

onMounted(() => {
    createLink().catch(console.error);
});

async function createLink() {
    try {
        const response = await $context.value.authenticatedServer.request({
            method: 'POST',
            path: '/impersonation',
            body: StartImpersonationRequest.create({ userId: props.user.id }),
            decoder: ImpersonationTicket as Decoder<ImpersonationTicket>,
            shouldRetry: false,
        });

        // An administrator wants to see what this account sees, so point the link at the
        // application that account normally uses. An organization with its own registration
        // domain still administrates on the dashboard domain, hence preferDashboard.
        const isAdmin = !!props.user.permissions && !props.user.permissions.isEmpty;
        const host = getAppHost(isAdmin ? 'dashboard' : 'registration', organization.value ?? null, isAdmin);
        link.value = 'https://' + host + '#impersonate=' + encodeURIComponent(response.data.ticket);
        validUntil.value = response.data.validUntil;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    loading.value = false;
}

async function copy() {
    if (!link.value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(link.value);
        Toast.success($t(`De link staat op je klembord.`)).show();
    } catch (e) {
        console.error(e);
        Toast.error($t(`Kopiëren is niet gelukt. Selecteer de link en kopieer ze zelf.`)).show();
    }
}
</script>
