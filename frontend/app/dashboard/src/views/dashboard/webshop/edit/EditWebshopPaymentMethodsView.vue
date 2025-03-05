<template>
    <SaveView :title="viewTitle" :loading="saving" :disabled="!hasChanges" @save="save">
        <h1>{{ viewTitle }}</h1>
        <p>{{ $t('c228c56d-caf0-40a7-aebd-ff883cad7f7f') }} <a class="inline-link" :href="$domains.getDocs('betaalmethodes-voor-webshops-instellen')" target="_blank">{{ $t('7fd04b13-e600-49b1-bafb-e4f642154bcd') }}</a>.</p>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <EditPaymentMethodsBox type="webshop" :organization="organization" :config="config" :private-config="privateConfig" :validator="errors.validator" @patch:config="patchConfig($event)" @patch:private-config="patchPrivateConfig($event)"/>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SaveView, STErrorsDefault, useOrganization } from '@stamhoofd/components';
import { PaymentConfiguration, PrivatePaymentConfiguration, PrivateWebshop, WebshopMetaData, WebshopPrivateMetaData } from '@stamhoofd/structures';

import { computed } from 'vue';
import EditPaymentMethodsBox from '../../../../components/EditPaymentMethodsBox.vue';
import { useEditWebshop, UseEditWebshopProps } from './useEditWebshop';

const props = defineProps<UseEditWebshopProps>();

const organization = useOrganization();
const { webshop, addPatch, errors, saving, save, hasChanges } = useEditWebshop({
    getProps: () => props,
});

const viewTitle = 'Betaalmethodes';
const config = computed(() => webshop.value.meta.paymentConfiguration);
const privateConfig = computed(() => webshop.value.privateMeta.paymentConfiguration);

function patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
    addPatch(
        PrivateWebshop.patch({
            meta: WebshopMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}

function patchPrivateConfig(patch: PrivatePaymentConfiguration) {
    addPatch(
        PrivateWebshop.patch({
            privateMeta: WebshopPrivateMetaData.patch({
                paymentConfiguration: patch,
            }),
        }),
    );
}
</script>
