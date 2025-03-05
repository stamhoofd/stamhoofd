<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`9437ee62-e33c-4660-80f8-d738123ceed1`)"/>

        <main>
            <h1>
                {{ $t('b7537bc6-0373-4754-941c-71d6dbb1904b') }}
            </h1>

            <p class="st-list-description">
                {{ $t('efd1964f-1503-43b6-aeac-8338e3c8dba6') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <p v-if="isComplete" class="success-box">
                {{ $t('2e94f6cd-560a-4e09-8f74-c5f1cdfca1f3') }}
            </p>

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record"/>
            </div>

            <p v-if="!isComplete" class="warning-box">
                {{ $t('5942fcf3-8e50-4fbe-a935-7608a8652ec0') }}
            </p>
            <p v-if="!isComplete" class="warning-box">
                {{ $t('a3f763c0-7268-48c1-8f49-1a857b28ff6f') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="skip">
                    {{ $t('3d9aefba-e4e1-4af8-a4cb-e1ff7bb9e351') }}
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('b445c285-9b64-4b1d-9033-3a2cdd2c743d') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ErrorBox, LoadingButton, STErrorsDefault, STNavigationBar, STToolbar, Toast, useContext, useErrors } from '@stamhoofd/components';
import { DNSRecordStatus, PrivateWebshop } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import DNSRecordBox from '../../../../components/DNSRecordBox.vue';
import { WebshopManager } from '../WebshopManager';

const props = defineProps<{
    webshopManager: WebshopManager;
}>();

const errors = useErrors();
const saving = ref(false);

const context = useContext();
const records = computed(() => props.webshopManager.webshop?.privateMeta.dnsRecords ?? []);
const dismiss = useDismiss();

const isComplete = computed(() => !records.value.find(r => r.status !== DNSRecordStatus.Valid));

function skip() {
    if (!isComplete.value) {
        new Toast('Hou er rekening mee dat jouw webshop voorlopig nog niet bereikbaar is op de door jou gekozen link. We gebruiken intussen de standaard domeinnaam van Stamhoofd. Wijzig eventueel de link terug tot iemand dit in orde kan brengen.', 'warning yellow').setHide(15 * 1000).show();
    }
    dismiss().catch(console.error);
}

async function validate() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/webshop/' + props.webshopManager.webshop!.id + '/verify-domain',
            decoder: PrivateWebshop as Decoder<PrivateWebshop>,
            shouldRetry: false,
        });

        saving.value = false;

        props.webshopManager.updateWebshop(response.data);

        if (response.data.meta.domainActive) {
            new Toast('Je domeinnaam is goed geconfigureerd, jouw webshop is nu bereikbaar op deze nieuwe link.', 'success green').show();
            dismiss({ force: true }).catch(console.error);
        }
        else {
            new Toast('We konden jouw domeinnaam nog niet activeren (zie foutmeldingen bij de DNS-records). Soms kan het even duren voor de wijzigingen doorkomen, we sturen je een e-mail zodra we ze wel opmerken.', 'error red').show();
        }
    }
    catch (e) {
        console.error(e);
        errors.errorBox = new ErrorBox(e);
        saving.value = false;
    }

    // this.pop({ force: true })
}
</script>
