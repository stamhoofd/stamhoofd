<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="invoices" class="st-view">
            <STNavigationBar :title="title" />

            <main>
                <h1>{{ title }}</h1>
                <p>{{ $t('Er kan een vertraging zijn tussen de betaling en het aanmaken van de facturen.') }}</p>

                <p v-if="invoices.length === 0" class="info-box">
                    {{ $t('Je hebt nog geen facturen ontvangen') }}
                </p>

                <STList v-else>
                    <DownloadInvoiceRow v-for="invoice of invoices" :key="invoice.id" :invoice="invoice" />
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking';
import type { DetailedPayableBalance } from '@stamhoofd/structures';
import { Invoice } from '@stamhoofd/structures';
import { onMounted, ref  } from 'vue';
import type {Ref} from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { useContext } from '../hooks';
import DownloadInvoiceRow from './DownloadInvoiceRow.vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';

const props = defineProps<{
    item: DetailedPayableBalance;
}>();

const title = $t('Facturen')
const invoices = ref(null) as Ref<null | Invoice[]>
const context = useContext();
const owner = useRequestOwner();
const errors = useErrors()

onMounted(() => {
    loadInvoices().catch(console.error)
})

// Fetch balance
async function loadInvoices() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: `/billing/${props.item.organization.id}/invoices`,
            decoder: new ArrayDecoder(Invoice as Decoder<Invoice>),
            shouldRetry: true,
            owner,
            timeout: 10_000,
        });

        invoices.value = response.data;
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
