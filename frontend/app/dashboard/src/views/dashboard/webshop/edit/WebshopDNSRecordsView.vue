<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%Rr`)" />

        <main>
            <h1>
                {{ $t('%My') }}
            </h1>

            <p>
                {{ $t('%Mz') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="isComplete" class="success-box">
                {{ $t('%Ro') }}
            </p>

            <div v-for="record in records" :key="record.id">
                <DNSRecordBox :record="record" />
            </div>

            <p v-if="!isComplete" class="warning-box">
                {{ $t('%N0') }}
            </p>
            <p v-if="!isComplete" class="warning-box">
                {{ $t('%N1') }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button secundary" type="button" @click="skip">
                    {{ $t('%Rp') }}
                </button>
                <LoadingButton :loading="saving">
                    <button class="button primary" type="button" @click="validate">
                        {{ $t('%Rq') }}
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { useDismiss } from '@simonbackx/vue-app-navigation';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { DNSRecordStatus, PrivateWebshop } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import DNSRecordBox from '../../../../components/DNSRecordBox.vue';
import type { WebshopManager } from '../WebshopManager';

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
