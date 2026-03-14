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
                    <STInputBox v-if="!hasCompanyNumber" title="Jouw naam" error-fields="firstName,lastName" :error-box="errors.errorBox">
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
                    :organization="patchedOrganization"
                    :required="false"
                />
            </template>

            <template v-if="proFormaInvoice && proFormaInvoice.totalWithVAT > 0 && selectedMandateId === null">
                <hr>

                <h2>Kies je betaalmethode</h2>

                <p class="info-box">
                    Betaal met de bankrekening van jouw vereniging en niet met een persoonlijke rekening. Deze bankrekening zal gebruikt worden voor toekomstige afrekeningen via domiciliëring.
                </p>

                <!-- todo: test, maybe create new separate component? -->
                <PaymentSelectionList v-model="selectedPaymentMethod" :amount="1" :payment-configuration="paymentConfiguration" :organization="patchedOrganization" />
            </template>

            <template v-else-if="proFormaInvoice && proFormaInvoice.totalWithVAT == 0 && selectedMandateId === null">
                <hr>

                <h2>Koppel de bankkaart of creditcard van je vereniging</h2>
                <p>
                    Je moet Stamhoofd koppelen aan een bankkaart waarmee je voor Stamhoofd zal betalen. Dit dient ter validatie van je vereniging. Deze bankkaart wordt enkel in specifieke gevallen aangesproken (als je geen online betalingen gebruikt, of een betaalmethode waarbij we via een andere weg de servicekosten moeten inhouden).
                </p>

                <p class="info-box">
                    Om je bankkaart te koppelen moeten we een betaling van 0,02 euro uitvoeren.
                </p>

                <!-- todo: test, maybe create new separate component? -->
                <PaymentSelectionList v-model="selectedPaymentMethod" :amount="1" :payment-configuration="paymentConfiguration" :organization="patchedOrganization" />
            </template>

            <Spinner v-if="loadingProForma" />

            <template v-else-if="proFormaInvoice && proFormaInvoice.totalWithVAT > 0">
                <hr>
                <h2>{{ $t('%YI') }}</h2>

                <STList>
                    <STListItem v-for="item in sortedItems" :key="item.id">
                        <h3 class="style-title-list pre-wrap" v-text="item.name" />
                        <p v-if="item.description" class="style-description-small pre-wrap" v-text="item.description" />

                        <template #right>
                            <span class="style-price-base" :class="{negative: item.unitPrice < 0}">{{ item.unitPrice === 0 ? 'Gratis' : formatPrice(item.unitPrice) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <PriceBreakdownBox :price-breakdown="proFormaInvoice.priceBreakdown" />
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

                <STList v-if="renewPackageDetails.meta.pricingType === 'PerMember'">
                    <STListItem>
                        Huidig aantal leden

                        <template #right>
                            {{ renewPackageDetails.meta.paidAmount }}
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.unitPrice">
                        Prijs

                        <template #right>
                            {{ Formatter.price(renewPackageDetails.meta.unitPrice) }} / jaar / lid
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.minimumAmount">
                        Minimum bedrag per jaar

                        <template #right>
                            {{ Formatter.price(renewPackageDetails.meta.minimumAmount * renewPackageDetails.meta.unitPrice) }}
                            ({{ renewPackageDetails.meta.minimumAmount }} leden)
                        </template>
                    </STListItem>

                    <STListItem>
                        Vanaf

                        <template #right>
                            {{ Formatter.date(renewPackageDetails.meta.startDate) }}
                        </template>
                    </STListItem>
                </STList>

                <STList v-else>
                    <STListItem v-if="renewPackageDetails.meta.startDate && renewPackageDetails.meta.startDate.getTime() > Date.now() + 10000">
                        Vanaf

                        <template #right>
                            {{ Formatter.date(renewPackageDetails.meta.startDate) }}
                        </template>
                    </STListItem>

                    <STListItem class="right-description">
                        Vaste prijs

                        <template #right>
                            {{ Formatter.price(renewPackageDetails.meta.unitPrice) }}
                        </template>
                    </STListItem>

                    <STListItem v-if="renewPackageDetails.meta.serviceFeePercentage && renewPackageDetails.meta.serviceFeeFixed" class="right-description">
                        Servicekosten

                        <template #right>
                            {{ Formatter.percentage(renewPackageDetails.meta.serviceFeePercentage) }} +
                            {{ Formatter.price(renewPackageDetails.meta.serviceFeeFixed) }}
                        </template>
                    </STListItem>

                    <STListItem v-else-if="renewPackageDetails.meta.serviceFeePercentage" class="right-description">
                        Servicekosten per stuk/ticket

                        <template #right>
                            {{ Formatter.percentage(renewPackageDetails.meta.serviceFeePercentage) }}
                            <p v-if="renewPackageDetails.meta.serviceFeeMinimum" class="style-description-small">
                                min. {{ Formatter.price(renewPackageDetails.meta.serviceFeeMinimum) }}
                            </p>
                            <p v-if="renewPackageDetails.meta.serviceFeeMaximum" class="style-description-small">
                                max. {{ Formatter.price(renewPackageDetails.meta.serviceFeeMaximum) }}
                            </p>
                        </template>
                    </STListItem>

                    <STListItem v-else-if="renewPackageDetails.meta.serviceFeeFixed">
                        Servicekosten per stuk/ticket

                        <template #right>
                            {{ Formatter.price(renewPackageDetails.meta.serviceFeeFixed) }}
                        </template>
                    </STListItem>
                </STList>
            </template>

            <p v-if="memberCountWarning" class="warning-box">
                {{ memberCountWarning }}
            </p>
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
import { AddressInput, CenteredMessage, Checkbox, CompanyNumberInput, ErrorBox, LoadingButton, PaymentSelectionList, PriceBreakdownBox, Spinner, STErrorsDefault, STInputBox, STList, STListItem, STNavigationBar, STToolbar, useContext, useErrors, useFeatureFlag, usePatch, useRequiredOrganization, useUser, VATNumberInput } from '@stamhoofd/components';
import { Address, CheckoutResponse, Country, Invoice, OrganizationMetaData, PackageCheckout, PackagePurchases, PaymentConfiguration, PaymentMethod, STPackage, STPackageBundle, STPackageBundleHelper, STPackageType } from '@stamhoofd/structures';
import { Formatter, Sorter, throttle } from '@stamhoofd/utility';
import { computed, onMounted, ref, watch } from 'vue';
import MandateSelectionList from './MandateSelectionList.vue';
import PackageSettingsView from './PackageSettingsView.vue';
import { useOrganizationPackages } from './hooks/useOrganizationPackages';

const props = withDefaults(
    defineProps<{
        // todo?
        bundles?: STPackageBundle[];
        renewPackages?: STPackage[];
        allowMandate: boolean;
        /**
     * Manual payment of outstanding balance
     */
        isManualPayment: boolean;
    }>(),
    {
        bundles: () => [] as STPackageBundle[],
        renewPackages: () => [] as STPackage[],
        allowMandate: true,
        isManualPayment: false,
    },
);

const errors = useErrors();
const { packages: status, reload: reloadPackages } = useOrganizationPackages({ errors, onMounted: true });
const context = useContext();
const show = useShow();
const canDismiss = useCanDismiss();
const canPop = useCanPop();
const navigationController = useNavigationController();
const user = useUser();
const featureFlag = useFeatureFlag();

const loading = ref(false);
const loadingProForma = ref(true);
let loadingProFormaCount = 0;
const terms = ref(false);

const proFormaInvoice = ref<Invoice | null>(null);

const sortedItems = computed(() => {
    if (!proFormaInvoice.value) {
        return null;
    }
    return proFormaInvoice.value.items.slice().sort((a, b) => {
        return Sorter.stack(
            Sorter.byNumberValue(a.totalWithoutVAT, b.totalWithoutVAT),
            Sorter.byStringValue(a.name, b.name),
        );
    });
});

const selectedPaymentMethod = ref(PaymentMethod.Unknown);
const selectedMandateId = ref<string | null>(null);

const requiredOrganization = useRequiredOrganization();
const { patched: patchedOrganization, addPatch: addOrganizationPatch } = usePatch(requiredOrganization.value);
const { patched: patchedUser, addPatch: addUserPatch } = usePatch(user.value!);

const throttledReload = throttle(loadProForma, 1000);

function throttledLoadProForma() {
    if (loading.value) {
        // Skip
        return;
    }
    loadingProForma.value = true;

    // Use counter to ignore older requests
    loadingProFormaCount++;

    throttledReload();
}

onMounted(() => {
    loadProForma().catch(console.error);
});

watch(() => selectedMandateId.value, () => {
    throttledLoadProForma();
});

const renewPackageDetails = computed(() => {
    if (props.renewPackages.length !== 1) {
        return null;
    }

    const renewPackage = props.renewPackages[0];

    const found = status.value?.packages.find(p2 => p2.id === renewPackage.id);
    if (found) {
        return found;
    }
    return null;
});

async function loadProForma() {
    loadingProForma.value = true;

    // Use counter to ignore older requests
    loadingProFormaCount++;
    const c = loadingProFormaCount;

    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/activate-packages',
            body: PackageCheckout.create({
                purchases: PackagePurchases.create({
                    packageBundles: props.bundles,
                    renewPackageIds: props.renewPackages.map(p => p.id),

                }),
                // todo
                // includePending: selectedMandateId.value ? (props.bundles.length || props.renewPackages.length ? false : true) : true,
                paymentMethod: selectedMandateId.value ? PaymentMethod.Unknown : selectedPaymentMethod.value,
                // todo
                // organizationPatch: organizationPatch.value.encode({ version: Version }),
                // todo
                // userPatch: userPatch.value.encode({ version: Version }),
                // todo
                // mandateId: selectedMandateId.value,
                proForma: true,
            }),
            // decoder: CheckoutResponse as Decoder<CheckoutResponse>,
        });

        if (c === loadingProFormaCount) {
            // todo
            // proFormaInvoice.value = response.data.invoice;
            await context.value.fetchOrganization(false);
            await reloadPackages();
        }
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }

    if (c === loadingProFormaCount) {
        loadingProForma.value = false;
    }
}

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
    get: () => patchedOrganization.value.address,
    set: (value: Address) => {
        if (address.value.toString() !== value.toString()) {
            addOrganizationPatch({ address: value });
            // todo: watch instead of side effects?
            throttledLoadProForma();
        }
    },
});

const companyAddress = computed({
    // todo: deprecated
    get: () => patchedOrganization.value.meta.companyAddress,
    set: (companyAddress: Address | null) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyAddress,
            }),
        });
        // todo: watch instead of side effects?
        throttledLoadProForma();
    },
});

const companyName = computed({
    // todo: deprecated
    get: () => patchedOrganization.value.meta.companyName,
    set: (companyName: string | null) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyName,
            }),
        });
    },
});

const VATNumber = computed({
    get: () => patchedOrganization.value.meta.VATNumber,
    set: (VATNumber: string | null) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                VATNumber,
                // VAT Number is equal to company number in Belgium, so don't ask twice
                companyNumber: country.value === Country.Belgium ? (VATNumber?.substring(2) ?? null) : undefined,
            }),
        });
        // todo: watch instead of side effects?
        throttledLoadProForma();
    },
});

const hasCompanyNumber = computed({
    get: () => patchedOrganization.value.meta.companyNumber !== null,
    set: (hasCompanyNumber: boolean) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyNumber: hasCompanyNumber ? (companyNumber.value ?? '') : null,
                VATNumber: hasCompanyNumber ? undefined : null,
                companyAddress: hasCompanyNumber ? (companyAddress.value ?? address.value) : null,
            }),
        });
    },
});

const hasVATNumber = computed({
    get: () => patchedOrganization.value.meta.VATNumber !== null,
    set: (hasVATNumber: boolean) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                VATNumber: hasVATNumber ? (VATNumber.value ?? '') : null,
            }),
        });
        // todo: watch instead of side effects?
        throttledLoadProForma();
    },
});

const companyNumber = computed({
    // todo: deprecated
    get: () => patchedOrganization.value.meta.companyNumber,
    set: (companyNumber: string | null) => {
        addOrganizationPatch({
            meta: OrganizationMetaData.patch({
                companyNumber,
            }),
        });
    },
});

const country = computed(() => companyAddress.value?.country ?? address.value.country);

const paymentMethods = computed(() => {
    const extra: PaymentMethod[] = [];

    if (featureFlag('stamhoofd-pay-by-transfer')) {
        extra.push(PaymentMethod.Transfer);
    }

    if (country.value === Country.Netherlands) {
        return [PaymentMethod.iDEAL, PaymentMethod.Bancontact, PaymentMethod.CreditCard, ...extra];
    }
    return [PaymentMethod.Bancontact, PaymentMethod.iDEAL, PaymentMethod.CreditCard, ...extra];
});

const paymentConfiguration = computed(() => {
    return PaymentConfiguration.create({
        paymentMethods: paymentMethods.value,
    });
});

const memberCountWarning = computed(() => {
    if (props.renewPackages.some(p => p.meta.type === STPackageType.Members)) {
        return 'Vergeet niet eerst een nieuwe inschrijvingsperiode te starten voor alle inschrijvingsgroepen, zodat ingeschreven leden van vorig jaar niet meteen opnieuw worden aangerekend (op zich geen verschil als je ledenaantal niet zakt). Inschrijvingsgroepen (zoals activiteiten) die je niet (meteen) verderzet, kan je archiveren.';
    }

    return null;
});

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
            body: PackageCheckout.create({
                purchases: PackagePurchases.create({
                    packageBundles: props.bundles,
                    renewPackageIds: props.renewPackages.map(p => p.id),

                }),
                // todo
                // includePending: selectedMandateId.value ? (props.bundles.length || props.renewPackages.length ? false : true) : true,
                paymentMethod: selectedMandateId.value ? PaymentMethod.Unknown : selectedPaymentMethod.value,
                // todo
                // organizationPatch: organizationPatch.value.encode({ version: Version }),
                // todo
                // userPatch: userPatch.value.encode({ version: Version }),
                // todo
                // mandateId: selectedMandateId.value,
            }),
            decoder: CheckoutResponse as Decoder<CheckoutResponse>,
        });

        // const response = await context.value.authenticatedServer.request({
        //     method: 'POST',
        //     path: '/billing/activate-packages',
        //     body: {
        //         bundles: props.bundles,
        //         renewPackageIds: props.renewPackages.map(p => p.id),
        //         includePending: selectedMandateId.value ? (props.bundles.length || props.renewPackages.length ? false : true) : true,
        //         paymentMethod: selectedMandateId.value ? PaymentMethod.Unknown : selectedPaymentMethod.value,
        //         organizationPatch: organizationPatch.value.encode({ version: Version }),
        //         userPatch: userPatch.value.encode({ version: Version }),
        //         mandateId: selectedMandateId.value,
        //     },
        //     decoder: STInvoiceResponse as Decoder<STInvoiceResponse>,
        // });
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

            try {
                // todo: is necesary?
                await reloadPackages();
            }
            catch (e) {
                console.error(e);
            }

            new CenteredMessage('Gelukt', 'Het pakket wordt meteen geactiveerd').addCloseButton().show();
            show({
                components: [new ComponentWithProperties(PackageSettingsView)],
                replace: navigationController.value.components.length,
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
