<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`593be376-e1c2-4d81-819f-6defa2df6a11`)" />

        <main>
            <h1>
                {{ $t('7087e475-b3a9-492c-9d56-bfa3e763e713') }}
            </h1>

            <p>
                {{ $t('1b2d46a6-22a9-485f-bb00-84facfa33d85') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="isComplete" class="success-box">
                {{ $t('0bf13973-2758-4481-8a21-79a50f1f9d05') }}
            </p>

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p v-if="!isComplete" class="warning-box">
                {{ $t('136b3eb5-4c3a-46d5-87f1-25293225a875') }}
            </p>
            <p v-if="!isComplete" class="warning-box">
                {{ $t('e1f9cde6-19dd-4c2d-93f2-1d962c823d1f') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="skip">
                    {{ $t('58ec13c4-413f-4977-b592-82c455b515ff') }}
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('6f3c5401-b3af-486b-a2dd-d5169edd810c') }}
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

        props.webshopManager.updateWebshop(response.data).catch(console.error);

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
