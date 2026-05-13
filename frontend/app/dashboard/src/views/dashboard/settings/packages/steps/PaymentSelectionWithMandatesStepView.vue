<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null" class="st-view">
            <STNavigationBar :title=" $t(`Afrekenen`)" />
            <main class="center">
                <h1>{{ $t('Afrekenen') }}</h1>

                <STErrorsDefault :error-box="errors.errorBox" />

                <div v-if="mandates?.length" class="container">
                    <STGrid>
                        <PaymentMandateRadioRow v-for="mandate of mandates" :key="mandate.id" v-model="mandateId" :mandate="mandate" />

                        <STGridItem v-if="model.requiresMandate" :selectable="true" element-name="label" class="right-stack left-center">
                            <template #left>
                                <Radio v-model="mandateId" name="choose-payment-mandate" :value="null" />
                            </template>

                            <h3 class="style-title-list">
                                {{ $t('Nieuwe bankkaart koppelen') }}
                            </h3>

                            <p class="style-description-small">
                                {{ $t('De betaalkaart waarmee je straks betaald zal worden opgeslagen en ook voor de periodieke afrekeningen gebruikt worden') }}
                            </p>
                        </STGridItem>

                        <STGridItem v-else :selectable="true" element-name="label" class="right-stack left-center">
                            <template #left>
                                <Radio v-model="mandateId" name="choose-payment-mandate" :value="null" />
                            </template>

                            <h3 class="style-title-list">
                                {{ $t('Andere kaart') }}
                            </h3>
                        </STGridItem>
                    </STGrid>
                </div>

                <div v-if="!mandateId" class="container">
                    <STInputBox error-fields="method" :error-box="errors.errorBox" class="max" :title="$t('Betaalmethode')">
                        <PaymentSelectionList v-model="selectedPaymentMethod" :for-mandate="model.requiresMandate" :payment-configuration="paymentConfiguration" :amount="proFormaData?.payment?.price ?? 2_00" :customer="model.checkout.customer" :country="payingOrganization.address.country" />
                    </STInputBox>

                    <STInputBox v-if="model.requiresMandate && !props.model.checkout.mandate" error-fields="createMandate" :error-box="errors.errorBox" class="max" :title="$t('Bevestiging')">
                        <STList>
                            <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                                <template #left>
                                    <Checkbox v-model="createMandate" />
                                </template>

                                <h3 class="style-title-list">
                                    {{ $t('Mijn kaart mag worden opgeslagen en voor de periodieke aanrekeningen gebruikt worden') }}
                                </h3>

                                <p class="style-description-small">
                                    {{ $t('We raden af om een persoonlijke kaart te gebruiken.') }}
                                </p>
                            </STListItem>
                        </STList>
                    </STInputBox>
                        
                    <STInputBox v-if="!model.requiresMandate && selectedPaymentMethod && PaymentMethodHelper.canCreateMandate(selectedPaymentMethod)" class="max" :title="$t('Opslaan')">
                        <STList>
                            <CheckboxListItem v-model="model.checkout.createMandate" :label="$t('Betaalkaart opslaan')" />
                        </STList>
                    </STInputBox>
                </div>

                <STInputBox v-if="model.requiresMandate && model.packages.length" class="max" :title="$t('Periodiek te betalen')">
                    <STList>
                        <STPackageRow v-for="pack of model.packages.filter(p => p.meta.requiresMandate)" :key="pack.id" :pack="pack" />
                    </STList>
                </STInputBox>
                <p class="style-description-small">
                    {{ $t('Kosten worden op het einde van de maand afgerekend of wekelijks als het openstaand bedrag hoger dan 50 euro wordt.') }}
                </p>

                <STInputBox v-if="proFormaData?.invoice" class="max" :title="$t('Nu te betalen')">
                    <InvoiceItemsBox :invoice="proFormaData?.invoice" />
                </STInputBox>
            </main>
            <STToolbar>
                <template v-if="loadingProForma || proFormaData?.payment" #left>
                    <span v-if="!loadingProForma" data-testid="total-text">{{ $t('%xL') }}: {{ formatPrice(proFormaData!.payment!.price) }}</span>
                    <span v-else class="style-placeholder-skeleton" />
                </template>
                <template #right>
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="button" data-testid="confirm-payment-method-button" @click="goNext">
                            <span class="icon card small" />
                            <span>{{ $t('%eX') }}</span>
                        </button>
                    </LoadingButton>
                </template>
            </STToolbar>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, Toast } from '@stamhoofd/components';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import CheckboxListItem from '@stamhoofd/components/inputs/CheckboxListItem.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import PaymentMandateRadioRow from '@stamhoofd/components/mandates/PaymentMandateRadioRow.vue';
import { useOrganizationPaymentMandates } from '@stamhoofd/components/mandates/useOrganizationPaymentMandates';
import LoadingButton from '@stamhoofd/components/navigation/LoadingButton.vue';
import STNavigationBar from '@stamhoofd/components/navigation/STNavigationBar.vue';
import STToolbar from '@stamhoofd/components/navigation/STToolbar.vue';
import STPackageRow from '@stamhoofd/components/packages/STPackageRow.vue';
import type { NavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import PaymentSelectionList from '@stamhoofd/components/views/PaymentSelectionList.vue';
import type { CheckoutResponse } from '@stamhoofd/structures';
import { PaymentMethod, PaymentMethodHelper } from '@stamhoofd/structures';
import { computed, ref, shallowRef, watch } from 'vue';
import InvoiceItemsBox from '../../../invoices/components/InvoiceItemsBox.vue';
import { useActivatePackages } from '../hooks/useActivatePackages';
import type { PackageCheckoutViewModel } from '../PackageCheckoutViewModel';

const props = defineProps<{
    model: PackageCheckoutViewModel;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const errors = useErrors();
const payingOrganization = useRequiredOrganization()

const loading = ref(false);
const navigate = useNavigationActions();

const selectedPaymentMethod = computed({
    get: () => props.model.checkout.paymentMethod,
    set: value => props.model.checkout.paymentMethod = value,
});

const paymentConfiguration = computed(() => props.model.paymentConfiguration);
const activatePackages = useActivatePackages();
const proFormaData = shallowRef<null | CheckoutResponse>(null);
const loadingProForma = ref(false);
const {mandates} = useOrganizationPaymentMandates({
    sellingOrganizationId: props.model.sellingOrganization.id,
    errors,
});

watch(mandates, (n, old) => {
    if (old === null && n !== null && n.length) {
        // Select default mandate
        mandateId.value = n[0].id
    }
})

const mandateId = computed({
    get: () => props.model.checkout.mandate?.id ?? null,
    set: (mandateId: string | null) => {
        if (mandateId === null) {
            props.model.checkout.mandate = null;
            return;
        }
        const found = mandates.value?.find(m => m.id === mandateId);
        if (found) {
            props.model.checkout.mandate = found;
        }
    },
})

const createMandate = computed({
    get: () => props.model.checkout.createMandate,
    set: (createMandate: boolean) => {
        props.model.checkout.createMandate = createMandate;
    },
})

// Update pro forma
// todo: cancel previous after changes
const realCreateMandate = computed(() => props.model.requiresMandate || (props.model.checkout.createMandate && !props.model.checkout.mandate))
watch(realCreateMandate, (n, old) => {
    if (n === old) {
        return;
    }
    loadProForma().catch(console.error);
}, {immediate: true, })

async function loadProForma() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        const response = await activatePackages(
            props.model.checkout.patch({
                proForma: true
            })
        )
        proFormaData.value = response
    } catch (e) {
        Toast.fromError(e).show()
        errors.errorBox = new ErrorBox(e)
    }
    loading.value = false
}

async function goNext() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        if (props.model.checkout.mandate) {
            // Not allowed
            props.model.checkout.paymentMethod = PaymentMethod.Unknown
        }
        if (createMandate.value === false && !props.model.checkout.mandate && props.model.requiresMandate) {
            throw new SimpleError({
                code: 'required_checkbox',
                message: $t('Verplicht aan te vinken: voor deze pakketten is het verplicht om een betaalkaart te koppelen waarop de periodieke kosten verrekend kunnen worden (meestal één keer per maand tenzij je niets gebruikt).'),
                field: 'createMandate'
            })
        }
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}
</script>
