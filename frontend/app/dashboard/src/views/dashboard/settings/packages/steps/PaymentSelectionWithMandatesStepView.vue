<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="mandates !== null" class="st-view shade">
            <STNavigationBar :title=" $t(`Afrekenen`)" />
            <main class="center">
                <h1>{{ $t('Afrekenen') }}</h1>

                <STErrorsDefault :error-box="errors.errorBox" />
                
                <div class="container categorized-box">
                    <h2>
                        {{ $t('Betaling') }}
                    </h2>

                    <STInputBox v-if="mandates?.length" error-fields="mandateId" :error-box="errors.errorBox" class="max">
                        <STGrid>
                            <PaymentMandateRadioRow v-for="mandate of mandates" :key="mandate.id" v-model="mandateId" :mandate="mandate">
                                <p v-if="mandateId === mandate.id && !mandate.isDefault && saveMandateAsDefault" class="style-description-small">
                                    <span class="style-tag success"><span class="icon success tiny" /><span>{{ $t('Zal worden ingesteld als standaard bankkaart') }}</span></span>
                                </p>
                            </PaymentMandateRadioRow>

                            <STGridItem :selectable="true" element-name="label" class="right-stack left-center">
                                <template #left>
                                    <Radio v-model="mandateId" name="choose-payment-mandate" :value="null" />
                                </template>

                                <h3 class="style-title-list">
                                    {{ $t('Nieuwe kaart') }}
                                </h3>
                                <p class="style-description-small">
                                    {{ $t('Betaal met een andere kaart') }}
                                </p>

                                <p v-if="model.requiresMandate && mandateId === null && saveMandateAsDefault" class="style-description-small">
                                    <span class="style-tag success"><span class="icon success tiny" /><span>{{ $t('Zal worden ingesteld als standaard bankkaart') }}</span></span>
                                </p>

                                <div v-else-if="!model.requiresMandate && mandateId === null" class="option">
                                    <Checkbox v-model="createMandate">
                                        {{ $t('Bankkaart opslaan') }}
                                    </Checkbox>
                                    <Checkbox v-if="createMandate && (!saveMandateAsDefault || mandates.length > 0)" v-model="saveMandateAsDefault">
                                        <h3 class="style-title-list">
                                            {{ $t('Instellen als standaard bankkaart') }}
                                        </h3>
                                        <p v-if="model.requiresMandate" class="style-description-small">
                                            {{ $t('Deze kaart zal ook worden gebruikt voor periodieke aanrekeningen') }}
                                        </p>
                                    </Checkbox>
                                </div>
                            </STGridItem>
                        </STGrid>
                    </STInputBox>

                    <STInputBox v-if="model.requiresMandate && mandateId === null" error-fields="createMandate" :error-box="errors.errorBox" class="max" :title="$t('Toestemming')">
                        <STList>
                            <STListItem :selectable="true" element-name="label" class="right-stack left-center">
                                <template #left>
                                    <Checkbox v-model="createMandate" />
                                </template>

                                <h3 class="style-title-list">
                                    {{ $t('Deze kaart opslaan en voor periodieke aanrekeningen gebruiken') }}
                                </h3>

                                <p class="style-description-small">
                                    {{ $t('We raden af om een persoonlijke kaart te gebruiken.') }}
                                </p>
                            </STListItem>
                        </STList>
                    </STInputBox>

                    <div v-if="!mandateId" class="container">
                        <STInputBox error-fields="method" :error-box="errors.errorBox" class="max" :title="$t('Betaalmethode')">
                            <PaymentSelectionList v-model="selectedPaymentMethod" :for-mandate="model.requiresMandate" :payment-configuration="paymentConfiguration" :amount="proFormaData?.payment?.price ?? 2_00" :customer="model.checkout.customer" :country="payingOrganization.address.country" />
                        </STInputBox>
                    </div>
                </div>

                <div class="container categorized-box">
                    <h2>{{ $t('Periodiek te betalen') }}</h2>
                    <STInputBox v-if="model.requiresMandate && model.packages.length" class="max">
                        <STList>
                            <STPackageRow v-for="pack of model.packages.filter(p => p.meta.requiresMandate)" :key="pack.id" :pack="pack" />
                        </STList>
                    </STInputBox>
                    <p class="style-description-small">
                        {{ $t('Kosten worden op het einde van de maand afgerekend of wekelijks als het openstaand bedrag hoger dan 50 euro wordt.') }}
                    </p>
                </div>

                <div v-if="proFormaData?.invoice && proFormaData.invoice.totalWithVAT !== 0" class="container categorized-box">
                    <h2>{{ $t('Nu te betalen') }}</h2>
                    <InvoiceItemsBox :invoice="proFormaData.invoice" />
                </div>
            </main>
            <STToolbar>
                <template v-if="loadingProForma || proFormaData?.payment" #left>
                    <span v-if="!loadingProForma" data-testid="total-text">{{ $t('Nu te betalen') }}: {{ formatPrice(proFormaData!.payment!.price) }}</span>
                    <span v-else class="style-placeholder-skeleton" />
                </template>
                <template #right>
                    <LoadingButton :loading="!proFormaData || loading">
                        <button v-if="proFormaData?.payment?.price === 0" class="button primary" type="button" data-testid="confirm-payment-method-button" @click="goNext">
                            <span class="icon play small" />
                            <span>{{ $t('Activeren') }}</span>
                        </button>

                        <button v-else class="button primary" type="button" data-testid="confirm-payment-method-button" @click="goNext">
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
import { PaymentMethod } from '@stamhoofd/structures';
import { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import { computed, ref, shallowRef, watch } from 'vue';
import InvoiceItemsBox from '../../../invoices/components/InvoiceItemsBox.vue';
import { useActivatePackages } from '../hooks/useActivatePackages';
import type { PackageCheckoutViewModel } from '../PackageCheckoutViewModel';
import { Formatter, sleep } from '@stamhoofd/utility';
import { Request } from '@simonbackx/simple-networking';
import { useRequestOwner } from '@stamhoofd/networking';

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

    if (n && mandateId.value) {
        if (!n.find(pp => pp.id === mandateId.value)) {
            // Mandate became invalid: reset
            mandateId.value = n[0]?.id ?? null
        }
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

            if (props.model.requiresMandate) {
                // Save as default
                props.model.checkout.createMandate = CreateMandateSettings.create({
                    saveAsDefault: true
                })
            }
        } else {
            console.error('Mandate not found', mandateId)
        }
    },
})

const createMandate = computed({
    get: () => !!props.model.checkout.createMandate,
    set: (createMandate: boolean) => {
        props.model.checkout.createMandate = createMandate ? CreateMandateSettings.create({
            saveAsDefault: props.model.requiresMandate ? true : ((mandates.value?.length ?? 0) === 0)
        }) : null;

    },
})

const saveMandateAsDefault = computed({
    // If we require a mandate, the choise is to select a new default payment method - so it will always be set as default
    get: () => props.model.checkout.createMandate?.saveAsDefault ?? false,
    set: (saveAsDefault: boolean) => {
        if (props.model.checkout.createMandate) {
            props.model.checkout.createMandate.saveAsDefault = props.model.requiresMandate ? true : saveAsDefault
        }
    },
})

// Update pro forma
// todo: cancel previous after changes
const realCreateMandate = computed(() => mandates.value === null ? null : ((!!props.model.checkout.createMandate || props.model.requiresMandate) && !props.model.checkout.mandate))
const loadProFormaBag = useRequestOwner()
watch(realCreateMandate, (n, old) => {
    if (n === old) {
        return;
    }
    console.log('update pro forma')

    Request.cancelAll(loadProFormaBag)
    loadProForma().catch(console.error);
}, {immediate: false})


async function loadProForma() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        const response = await activatePackages(
            props.model.checkout.patch({
                proForma: true
            }), {
                shouldRetry: true,
                owner: loadProFormaBag
            }
        )
        const old = proFormaData.value
        proFormaData.value = response

        if (old) {
            if (old.payment?.price !== undefined && response.payment?.price !== undefined) {
                const from = old.payment.price;
                const to =  response.payment.price

                if (from === 0 && to > from && to < 1_00_00) {
                    Toast.info($t('Er wordt een kleine kost aangerekend van {price} voor de verificatie van je bankkaart', {price: Formatter.price(to)})).show()
                }

            }
        }
    } catch (e) {
        if (Request.isAbortError(e)) {
            loading.value = false
            return;
        }
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
                message: $t('Verplicht aan te vinken: voor deze pakketten is het verplicht om een bankkaart te koppelen waarop de periodieke kosten verrekend kunnen worden (meestal één keer per maand tenzij je niets gebruikt).'),
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
