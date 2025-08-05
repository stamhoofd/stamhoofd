<template>
    <div class="st-view background package-confirm-view">
        <STNavigationBar title="Betalen" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1 v-if="bundles.length === 1">
                {{ STPackageBundleHelper.getTitle(bundles[0]) }} activeren
            </h1>
            <h1 v-else-if="bundles.length" class="style-navigation-title">
                Functionaliteiten activeren
            </h1>
            <h1 v-else-if="isManualPayment" class="style-navigation-title">
                Openstaand bedrag betalen
            </h1>
            <h1 v-else-if="!allowMandate" class="style-navigation-title">
                Nieuwe betaalmethode toevoegen
            </h1>
            <h1 v-else-if="renewPackages.length" class="style-navigation-title">
                Functionaliteiten verlengen
            </h1>
            <h1 v-else class="style-navigation-title">
                Standaard betaalmethode wijzigen
            </h1>
            <p v-if="bundles.length">
                We hebben nog enkele gegevens van je nodig om de activatie te bevestigen.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <hr>
            <h2>Facturatiegegevens</h2>

            <Checkbox v-model="hasCompanyNumber">
                Onze vereniging heeft een {{ country == 'NL' ? 'KVK-nummer' : 'ondernemingsnummer' }}
                <p class="style-description-small">
                    Vink dit aan als je bent geregistreerd als {{ country != 'BE' ? 'vereniging' : 'VZW' }} of stichting
                </p>
            </Checkbox>
            <Checkbox v-if="hasCompanyNumber" v-model="hasVATNumber">
                Onze vereniging is BTW-plichtig
            </Checkbox>

            <div class="split-inputs">
                <div>
                    <STInputBox :title="hasCompanyNumber ? 'Bedrijfsnaam en rechtsvorm' : 'Officiële naam vereniging'" error-fields="companyName" :error-box="errors.errorBox">
                        <input
                            id="business-name"
                            v-model="companyName"
                            class="input"
                            type="text"
                            :placeholder="country == 'BE' ? 'bv. Ruimtereis VZW' : 'bv. Ruimtereis vereniging'"
                            autocomplete="organization"
                        >
                    </STInputBox>
                    <p v-if="hasCompanyNumber && country == 'BE'" class="style-description-small">
                        Vul ook de rechtsvorm in, bv. VZW.
                    </p>
                    <AddressInput v-if="hasCompanyNumber" key="companyAddress" v-model="companyAddress" :required="true" title="Maatschappelijke zetel" :validator="errors.validator" />
                    <AddressInput v-else key="address" v-model="address" :required="true" title="Adres" :validator="errors.validator" />
                </div>
                <div>
                    <STInputBox v-if="!hasCompanyNumber" title="Jouw naam" error-fields="firstName,lastName" :error-box="errors.validator">
                        <div class="input-group">
                            <div>
                                <input v-model="firstName" class="input" type="text" placeholder="Voornaam" autocomplete="given-name">
                            </div>
                            <div>
                                <input v-model="lastName" class="input" type="text" placeholder="Achternaam" autocomplete="family-name">
                            </div>
                        </div>
                    </STInputBox>
                    <CompanyNumberInput v-if="hasCompanyNumber && (!hasVATNumber || country != 'BE')" v-model="companyNumber" :country="country" placeholder="Jullie ondernemingsnummer" :validator="errors.validator" :required="true" />
                    <VATNumberInput v-if="hasVATNumber" v-model="VATNumber" title="BTW-nummer" placeholder="Jullie BTW-nummer" :country="country" :validator="errors.validator" :required="true" />
                </div>
            </div>

            <template v-if="allowMandate || selectedMandateId">
                <hr>
                <h2 v-if="bundles.length || renewPackages.length">
                    Standaard betaalmethode
                </h2>
                <h2 v-else>
                    Betaalmethode
                </h2>

                <p v-if="bundles.length || renewPackages.length">
                    Je moet Stamhoofd koppelen aan een bankkaart waarmee je voor Stamhoofd zal betalen. Dit dient ter validatie van je vereniging. Deze bankkaart wordt enkel in specifieke gevallen aangesproken (als je geen online betalingen gebruikt, of een betaalmethode waarbij we via een andere weg de servicekosten moeten inhouden).
                </p>
                <p v-else>
                    Kies één van de reeds opgeslagen betaalmethodes of koppel een nieuwe betaalmethode.
                </p>

                <MandateSelectionList
                    v-model="selectedMandateId"
                    :organization="organization"
                    :required="false"
                />
            </template>

            <template v-if="proFormaInvoice && proFormaInvoice.meta.priceWithVAT > 0 && selectedMandateId === null">
                <hr>

                <h2>Kies je betaalmethode</h2>

                <p class="info-box">
                    Betaal met de bankrekening van jouw vereniging en niet met een persoonlijke rekening. Deze bankrekening zal gebruikt worden voor toekomstige afrekeningen.
                </p>

                <PaymentSelectionList v-model="selectedPaymentMethod" :organization="organization" :payment-configuration="paymentConfiguration" :amount="proFormaInvoice.meta.priceWithVAT" />
            </template>

            <template v-else-if="proFormaInvoice && proFormaInvoice.meta.priceWithVAT == 0 && selectedMandateId === null">
                <hr>

                <h2>Koppel de bankkaart of creditcard van je vereniging</h2>
                <p>
                    Je moet Stamhoofd koppelen aan een bankkaart waarmee je voor Stamhoofd zal betalen. Dit dient ter validatie van je vereniging. Deze bankkaart wordt enkel in specifieke gevallen aangesproken (als je geen online betalingen gebruikt, of een betaalmethode waarbij we via een andere weg de servicekosten moeten inhouden).
                </p>

                <p class="info-box">
                    Om je bankkaart te koppelen moeten we een betaling van 0,02 euro uitvoeren.
                </p>

                <PaymentSelectionList v-model="selectedPaymentMethod" :organization="organization" :payment-configuration="paymentConfiguration" :amount="proFormaInvoice.meta.priceWithVAT" />
            </template>

            <Spinner v-if="loadingProForma" />

            <template v-else-if="proFormaInvoice && proFormaInvoice.meta.priceWithVAT > 0">
                <hr>
                <h2>Overzicht</h2>
                <STList>
                    <STListItem v-for="item in proFormaInvoice.meta.items" :key="item.id">
                        <template #left>
                            {{ item.amount }}x
                        </template>

                        <h3 class="style-title-list">
                            {{ item.name }}
                        </h3>
                        <p class="style-description">
                            {{ item.description }}
                        </p>

                        <template #right>
                            {{ Formatter.price(item.price) }}
                        </template>
                    </STListItem>
                </STList>

                <div class="pricing-box">
                    <STList>
                        <STListItem>
                            Prijs excl. BTW

                            <template #right>
                                {{ Formatter.price(proFormaInvoice.meta.priceWithoutVAT) }}
                            </template>
                        </STListItem>

                        <STListItem>
                            BTW ({{ proFormaInvoice.meta.VATPercentage }}%)

                            <template #right>
                                {{ Formatter.price(proFormaInvoice.meta.VAT) }}
                            </template>
                        </STListItem>

                        <STListItem>
                            Te betalen

                            <template #right>
                                {{ Formatter.price(proFormaInvoice.meta.priceWithVAT) }}
                            </template>
                        </STListItem>
                    </STList>
                </div>
            </template>

            <hr>
            <h2>Algemene voorwaarden</h2>

            <STInputBox :error-box="errors.errorBox" error-fields="terms" class="max">
                <Checkbox v-model="terms">
                    Ik ga akkoord met de <a :href="'https://'+$t('shared.domains.marketing')+'/terms/algemene-voorwaarden'" target="_blank" class="inline-link">algemene voorwaarden</a>
                </Checkbox>
            </STInputBox>

            <template v-if="renewPackageDetails">
                <hr>
                <h2>Prijsdetails</h2>
                <p>
                    Meer info over alle prijzen en een prijscalculator kan je terugvinden op <a :href="'https://'+$t('shared.domains.marketing')+'/prijzen'" class="inline-link" target="_blank">onze website</a>.
                </p>

                <STList>
                    <STListItem v-if="renewPackageDetails.meta.startDate && renewPackageDetails.meta.startDate.getTime() > Date.now() + 10000">
                        Vanaf

                        <template #right>
                            {{ Formatter.startDate(renewPackageDetails.meta.startDate) }}
                        </template>
                    </STListItem>

                    <STListItem class="right-description">
                        Vaste prijs

                        <template #right>
                            {{ Formatter.price(renewPackageDetails.meta.unitPrice) }}
                        </template>
                    </STListItem>
                </STList>
            </template>
        </main>

        <STToolbar>
            <template #right>
                <LoadingButton :loading="loading">
                    <button v-if="bundles.length || renewPackages.length" class="button primary" type="button" @click="checkout">
                        <span class="icon success" />
                        <span>Activeren</span>
                    </button>
                    <button v-else-if="isManualPayment" class="button primary" type="button" @click="checkout">
                        <span>Betalen</span>
                        <span class="icon arrow-right" />
                    </button>
                    <button v-else-if="!selectedMandateId" class="button primary" type="button" @click="checkout">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                    <button v-else class="button primary" type="button" @click="checkout">
                        <span>Opslaan</span>
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, useCanDismiss, useCanPop, useNavigationController, useShow } from '@simonbackx/vue-app-navigation';
import { AddressInput, CenteredMessage, Checkbox, CompanyNumberInput, ErrorBox, LoadingButton, PaymentSelectionList, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, useContext, useErrors, usePatch, useRequiredOrganization, VATNumberInput } from '@stamhoofd/components';
import { Country, OrganizationMetaData, PaymentMethod, STInvoice, STInvoiceResponse, STPackage, STPackageBundle, STPackageBundleHelper, User, Version } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, Ref, ref, watch } from 'vue';
import MandateSelectionList from './MandateSelectionList.vue';
import PackageSettingsView from './PackageSettingsView.vue';

const throttle = (callback: () => Promise<void>, limit: number) => {
    let lastFunc: NodeJS.Timeout | undefined = undefined;
    let lastRan: number = 0;

    return function () {
        // todo: is this correct?
        if (lastRan) {
            clearTimeout(lastFunc);
        }
        lastRan = Date.now();

        lastFunc = setTimeout(function () {
            if (Date.now() - lastRan >= limit) {
                callback().catch(console.error);
                lastRan = Date.now();
            }
        }, limit - (Date.now() - lastRan));
    };
};

const props = withDefaults(defineProps<{
    bundles?: STPackageBundle[];
    renewPackages?: STPackage[];
    allowMandate?: boolean;
    /**
     * Manual payment of outstanding balance
     */
    isManualPayment?: boolean;
}>(), {
    bundles: () => [],
    renewPackages: () => [],
    allowMandate: true,
    isManualPayment: false,
});

const errors = useErrors();
const context = useContext();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const navigationController = useNavigationController();
const show = useShow();
const loading = ref(false);
const loadingProForma = ref(true);
const loadingProFormaCount = ref(0);
const terms = ref(false);
const proFormaInvoice: Ref<STInvoice | null> = ref(null);
const selectedPaymentMethod = ref<PaymentMethod>(PaymentMethod.Unknown);
const selectedMandateId = ref<string | null>(null);
const organization = useRequiredOrganization();
const user = computed(() => User.create(context.value.user!));
const { patch: organizationPatch, addPatch: addOrganizationPatch } = usePatch(organization.value);
const { patch: userPatch, patched: patchedUser, addPatch: addUserPatch } = usePatch(user.value);

const loadProForma = async () => {
    loadingProForma.value = true;

    // Use counter to ignore older requests
    loadingProFormaCount.value++;
    const c = loadingProFormaCount.value;

    try {
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: {
                bundles: props.bundles,
                renewPackageIds: props.renewPackages.map(p => p.id),
                includePending: selectedMandateId.value ? (props.bundles.length || props.renewPackages.length ? false : true) : true,
                paymentMethod: selectedMandateId.value ? PaymentMethod.Unknown : selectedPaymentMethod.value,
                organizationPatch: organizationPatch.value.encode({ version: Version }),
                userPatch: userPatch.value.encode({ version: Version }),
                mandateId: selectedMandateId.value,
                proForma: true,
            },
            decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
        });
        if (c === loadingProFormaCount.value) {
            proFormaInvoice.value = response.data.invoice ?? null;
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    if (c === loadingProFormaCount.value) {
        loadingProForma.value = false;
    }
};

const throttledReload = throttle(loadProForma, 1000);

function throttledLoadProForma() {
    if (loading.value) {
        // Skip
        return;
    }
    loadingProForma.value = true;

    // Use counter to ignore older requests
    loadingProFormaCount.value++;

    throttledReload();
}

onMounted(() => {
    loadProForma().catch(console.error);
});

watch(() => selectedMandateId.value, () => {
    throttledLoadProForma();
});

const renewPackageDetails = computed(() => {
    if (proFormaInvoice.value?.meta?.items?.length !== 1) {
        return null;
    }
    const p = proFormaInvoice.value.meta.items[0].package;
    return p ?? null;
});

const firstName = computed({
    get: () => patchedUser.value.firstName,
    set: (firstName: string | null) => {
        addUserPatch({ firstName });
    },
});

const lastName = computed({
    get: () => patchedUser.value.lastName,
    set: (lastName: string | null) => {
        addUserPatch({ lastName });
    },
});

const address = computed({
    get: () => organization.value.address,
    set: (newAddress) => {
        if (address.value.toString() !== newAddress.toString()) {
            addOrganizationPatch({ address: newAddress });
            throttledLoadProForma();
        }
    },
});

const companyAddress = computed({
    get: () => organization.value.meta.companyAddress,
    set: (companyAddress) => {
        addOrganizationPatch({ meta: OrganizationMetaData.patch({ companyAddress }) });
        throttledLoadProForma();
    },
});

const companyName = computed({
    get: () => organization.value.meta.companyName,
    set: (companyName) => {
        addOrganizationPatch({ meta: OrganizationMetaData.patch({ companyName }) });
        throttledLoadProForma();
    },
});

const country = computed(() => companyAddress.value?.country ?? address.value.country);

const VATNumber = computed({
    get: () => organization.value.meta.VATNumber,
    set: (value) => {
        addOrganizationPatch({ meta: OrganizationMetaData.patch({ VATNumber: value,
            // VAT Number is equal to company number in Belgium, so don't ask twice
            companyNumber: country.value === Country.Belgium ? (value?.substring(2) ?? null) : undefined,
        }),

        });
        throttledLoadProForma();
    },
});

const hasCompanyNumber = computed({
    get: () => organization.value.meta.companyNumber !== null,
    set: (value) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyNumber: value ? (companyNumber.value ?? '') : null,
                VATNumber: value ? undefined : null,
                companyAddress: value ? (companyAddress.value ?? address.value) : null,
            }),
        });
    } });

const hasVATNumber = computed({
    get: () => organization.value.meta.VATNumber !== null,
    set: (value) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                VATNumber: value ? (VATNumber.value ?? '') : null,
            }),
        });
        throttledLoadProForma();
    },
});

const companyNumber = computed({
    get: () => organization.value.meta.companyNumber,
    set: (value) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyNumber: value,
            }),
        });
    },
});

// function getFeatureFlag(flag: string) {
//     return organization.value.privateMeta?.featureFlags.includes(flag) ?? false;
// }

// const paymentMethods = computed(() => {
//     const extra: PaymentMethod[] = [];

//     extra.push(PaymentMethod.DirectDebit);

//     if (getFeatureFlag('stamhoofd-pay-by-transfer')) {
//         extra.push(PaymentMethod.Transfer);
//     }

//     if (country.value == Country.Netherlands) {
//         return [PaymentMethod.iDEAL, PaymentMethod.Bancontact, PaymentMethod.CreditCard, ...extra];
//     }
//     return [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.CreditCard, ...extra];
// });

// todo: this is probably wrong
const paymentConfiguration = computed(() => organization.value!.meta.registrationPaymentConfiguration);

async function checkout() {
    if (loading.value) {
        return;
    }
    loading.value = true;

    try {
        if (!await errors.validator.validate()) {
            loading.value = false;
            return;
        }

        if (!terms.value) {
            throw new SimpleError({
                code: 'terms_required',
                message: 'The terms should be accepted',
                human: 'Je moet de algemene voorwaarden accepteren voor je een betaling kan doen',
                field: 'terms',
            });
        }
        const response = await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: {
                bundles: props.bundles,
                renewPackageIds: props.renewPackages.map(p => p.id),
                includePending: selectedMandateId.value ? (props.bundles.length || props.renewPackages.length ? false : true) : true,
                paymentMethod: selectedMandateId.value ? PaymentMethod.Unknown : selectedPaymentMethod.value,
                organizationPatch: organizationPatch.value.encode({ version: Version }),
                userPatch: userPatch.value.encode({ version: Version }),
                mandateId: selectedMandateId.value,
            },
            decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
        });
        if (response.data.paymentUrl) {
            window.location.href = response.data.paymentUrl;
        }
        else {
            // Reload organization
            try {
                await context.value.fetchOrganization();
            }
            catch (e) {
                console.error(e);
            }
            new CenteredMessage('Gelukt', 'Het pakket wordt meteen geactiveerd').addCloseButton().show();
            show({
                components: [new ComponentWithProperties(PackageSettingsView)],
                replace: navigationController.value?.components.length,
                reverse: true,
                force: true,
            }).catch(console.error);
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
        loading.value = false;

        // Reload if something changed
        throttledLoadProForma();
    }

    loading.value = false;
}

function shouldNavigateAway() {
    // TODO
    if (loading.value) {
        return false;
    }
    return true;
}

defineExpose({
    shouldNavigateAway,
});
</script>
