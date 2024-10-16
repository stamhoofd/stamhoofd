<template>
    <LoadingView v-if="loadingStripeAccounts" />
    <div v-else class="container">
        <STErrorsDefault :error-box="errors.errorBox" />
        <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" title="Betaalaccount" error-fields="stripeAccountId">
            <Dropdown v-model="stripeAccountId">
                <option v-if="hasMollieOrBuckaroo" :value="null">
                    {{ mollieOrBuckarooName }}
                </option>
                <option v-else :value="null">
                    Geen
                </option>
                <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                    {{ account.meta.settings.dashboard.display_name }} - {{ account.meta.business_profile.name }}, xxxx {{ account.meta.bank_account_last4 }} - {{ account.accountId }}
                </option>
            </Dropdown>
        </STInputBox>
        <p v-if="stripeAccountObject && stripeAccountObject.warning" :class="stripeAccountObject.warning.type + '-box'">
            {{ stripeAccountObject.warning.text }}
            <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                Meer info
            </a>
        </p>

        <STList>
            <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label" :disabled="!canEnablePaymentMethod(method)">
                <template #left>
                    <Checkbox :model-value="getPaymentMethod(method)" @update:model-value="setPaymentMethod(method, $event)" />
                </template>
                <h3 class="style-title-list">
                    {{ getName(method) }}
                </h3>
                <p v-if="showPrices && getPaymentMethod(method) && getDescription(method)" class="style-description-small pre-wrap" v-text="getDescription(method)" />
            </STListItem>
        </STList>

        <template v-if="hasTransfers">
            <hr>

            <h2>Overschrijvingen</h2>

            <STInputBox title="Begunstigde" error-fields="transferSettings.creditor" :error-box="errors.errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    :placeholder="organization.name"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" :validator="validator" :required="true" />

            <STInputBox title="Soort mededeling" error-fields="transferSettings.type" :error-box="errors.errorBox" class="max">
                <STList>
                    <STListItem v-for="_type in transferTypes" :key="_type.value" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="transferType" :value="_type.value" />
                        </template>
                        <h3 class="style-title-list">
                            {{ _type.name }}
                        </h3>
                        <p v-if="transferType === _type.value" class="style-description pre-wrap" v-text="_type.description" />
                    </STListItem>
                </STList>
            </STInputBox>

            <p v-if="transferType !== 'Structured'" class="warning-box">
                <span>De mededeling kan niet gewijzigd worden door <span v-if="type === 'webshop'">bestellers</span><span v-else>leden</span>. Voorzie dus zelf geen eigen vervangingen zoals <em class="style-em">bestelling + naam</em> waarbij je ervan uitgaat dat de betaler manueel de mededeling kan invullen en wijzigen. Gebruik in plaats daarvan de 'Vaste mededeling' met de beschikbare automatische vervangingen.</span>
            </p>

            <STInputBox v-if="transferType !== 'Structured'" :title="transferType === 'Fixed' ? 'Mededeling' : 'Voorvoegsel'" error-fields="transferSettings.prefix" :error-box="errors.errorBox">
                <input
                    v-model="prefix"
                    class="input"
                    type="text"
                    :placeholder="transferType === 'Fixed' ? 'Mededeling' : (type === 'registration' ? 'Optioneel. Bv. Inschrijving' : 'Optioneel. Bv. Bestelling')"
                    autocomplete=""
                >
            </STInputBox>

            <p v-if="transferExample && transferExample !== prefix" class="style-description-small">
                Voorbeeld: <span class="style-em">{{ transferExample }}</span>
            </p>

            <p v-if="transferType === 'Fixed' && type === 'webshop'" class="style-description-small">
                Gebruik automatische tekstvervangingen in de mededeling via <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`" />, <code v-copyable class="style-inline-code style-copyable" v-text="`{{email}}`" /> of <code v-copyable class="style-inline-code style-copyable" v-text="`{{nr}}`" />
            </p>
            <p v-else-if="transferType === 'Fixed' && type === 'registration'" class="style-description-small">
                Gebruik automatische tekstvervangingen in de mededeling via <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`" />
            </p>
        </template>

        <template v-if="showAdministrationFee">
            <hr>
            <h2>Administratiekosten</h2>
            <p>{{ $t('b091538b-014e-4db2-8241-9ed98e0c51c7') }}</p>

            <div class="split-inputs">
                <STInputBox title="Vaste kost" error-fields="administrationFee.fixed" :error-box="errors.errorBox">
                    <PriceInput v-model="fixed" :min="0" placeholder="Vaste kost" :required="true" />
                </STInputBox>

                <STInputBox title="Percentage" error-fields="administrationFee.fixed" :error-box="errors.errorBox">
                    <PermyriadInput v-model="percentage" placeholder="Percentage" :required="true" />
                </STInputBox>
            </div>

            <Checkbox v-if="fixed > 0" v-model="zeroIfZero">
                Reken geen administratiekosten aan als het totaalbedrag 0 euro is
            </Checkbox>

            <p v-if="percentage && exampleAdministrationFee1" class="style-description-small">
                Voorbeeld: de aangerekende administratiekost bedraagt {{ formatPrice(exampleAdministrationFee1) }} op een bedrag van {{ formatPrice(exampleAdministrationFeeValue1) }}, en {{ formatPrice(exampleAdministrationFee2) }} op een bedrag van {{ formatPrice(exampleAdministrationFeeValue2) }}.
            </p>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { Checkbox, Dropdown, ErrorBox, IBANInput, LoadingView, PermyriadInput, PriceInput, Radio, STErrorsDefault, STInputBox, STList, STListItem, Toast, useContext, useCountry, useErrors, useRequiredOrganization, useValidation, Validator } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { AdministrationFeeSettings, Country, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PaymentProvider, PrivatePaymentConfiguration, StripeAccount, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';

const props = withDefaults(defineProps<{
    type: 'registration' | 'webshop';
    showAdministrationFee?: boolean;
    validator?: Validator | null;
    privateConfig: PrivatePaymentConfiguration;
    config: PaymentConfiguration;
    choices?: PaymentMethod[] | null;
    showPrices?: boolean;
}>(), {
    showAdministrationFee: true,
    validator: null,
    choices: null,
    showPrices: true,
});

const loadingStripeAccounts = ref(false);
const stripeAccounts = ref<StripeAccount[]>([]);

const context = useContext();
const owner = useRequestOwner();
const organization = useRequiredOrganization();
const emit = defineEmits(['patch:privateConfig', 'patch:config']);
const $t = useTranslate();
const country = useCountry();
const errors = useErrors({ validator: props.validator });

loadStripeAccounts().catch(console.error);

if (props.validator) {
    useValidation(props.validator, async () => {
        clean();
        await nextTick();

        if (loadingStripeAccounts.value) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'loading',
                message: 'Nog bezig met laden. Even geduld.',
            }));
            return false;
        }

        if (props.config.paymentMethods.length === 0) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'no_payment_methods',
                message: 'Je moet minimaal één betaalmethode selecteren',
            }));
            return false;
        }

        errors.errorBox = null;

        return true;
    });
}

function patchPrivateConfig(patch: AutoEncoderPatchType<PrivatePaymentConfiguration>) {
    emit('patch:privateConfig', patch);
}
function patchConfig(patch: AutoEncoderPatchType<PaymentConfiguration>) {
    emit('patch:config', patch);
}

const hasTransfers = computed(() => {
    return props.config.paymentMethods.includes(PaymentMethod.Transfer);
});

async function loadStripeAccounts() {
    try {
        loadingStripeAccounts.value = true;
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/accounts',
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            shouldRetry: true,
            owner,
        });
        stripeAccounts.value = response.data;
        if (!hasMollieOrBuckaroo.value && !stripeAccountObject.value) {
            stripeAccountId.value = stripeAccounts.value[0]?.id ?? null;
        }
        nextTick().finally(() => {
            setDefaultSelection();
        }).catch(console.error);
    }
    catch (e) {
        console.error(e);
        new Toast('Er is een fout opgetreden bij het ophalen van de betaalaccounts', 'error red').show();
    }
    loadingStripeAccounts.value = false;
}

function setDefaultSelection() {
    if (props.config.paymentMethods.length === 0) {
        const ignore = [
            PaymentMethod.Unknown,
            PaymentMethod.Transfer,
            PaymentMethod.PointOfSale,
        ];

        let found = false;

        // Check if online payments are enabled
        for (const p of sortedPaymentMethods.value) {
            if (!ignore.includes(p) && canEnablePaymentMethod(p)) {
                setPaymentMethod(p, true);
                found = true;
            }
        }

        if (!found) {
            // Enable transfer
            setPaymentMethod(PaymentMethod.Transfer, true);
        }
    }
    else {
        clean();
    }
}

const stripeAccountId = computed({
    get: () => {
        return props.privateConfig.stripeAccountId;
    },
    set: (value: string | null) => {
        patchPrivateConfig(PrivatePaymentConfiguration.patch({
            stripeAccountId: value,
        }));

        // Clear all unsupported payment methods
        nextTick().finally(() => {
            clean();
        }).catch(console.error);
    },
});

function clean() {
    for (const method of props.config.paymentMethods) {
        if (!canEnablePaymentMethod(method)) {
            setPaymentMethod(method, false, true);
        }
    }
}

const stripeAccountObject = computed(() => {
    return stripeAccounts.value.find(a => a.id === stripeAccountId.value) ?? null;
});

const sortedPaymentMethods = computed(() => {
    if (props.choices !== null) {
        return props.choices;
    }

    const r: PaymentMethod[] = [];

    // Force a given ordering
    if (country.value === Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    // Force a given ordering
    if (country.value === Country.Belgium || getPaymentMethod(PaymentMethod.Payconiq)) {
        r.push(PaymentMethod.Payconiq);
    }

    // Force a given ordering
    r.push(PaymentMethod.Bancontact);

    // Force a given ordering
    if (country.value !== Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
    }

    r.push(PaymentMethod.CreditCard);

    if (canEnablePaymentMethod(PaymentMethod.DirectDebit) || getPaymentMethod(PaymentMethod.DirectDebit)) {
        r.push(PaymentMethod.DirectDebit);
    }

    r.push(PaymentMethod.Transfer);
    r.push(PaymentMethod.PointOfSale);

    // Sort so all disabled are at the end:
    r.sort((a, b) => Sorter.byBooleanValue(canEnablePaymentMethod(a), canEnablePaymentMethod(b)));
    return r;
});

function getName(paymentMethod: PaymentMethod): string {
    return PaymentMethodHelper.getNameCapitalized(paymentMethod);
}

function providerText(provider: PaymentProvider | null, map: { [key: string]: string }): string {
    if (provider === null) {
        return '';
    }
    else {
        return map[provider];
    }
}

function getDescription(paymentMethod: PaymentMethod): string {
    const provider = organization.value.privateMeta?.getPaymentProviderFor(paymentMethod, stripeAccountObject.value?.meta) ?? PaymentProvider.Stripe;

    switch (paymentMethod) {
        case PaymentMethod.Transfer: return $t('d2749916-b99a-47af-9bc4-300648fe77a7');
        case PaymentMethod.Payconiq:
            return providerText(provider, {
                [PaymentProvider.Payconiq]: '',
                [PaymentProvider.Buckaroo]: 'Via Buckaroo',
            });
        case PaymentMethod.Bancontact:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: 'Via Buckaroo',
                [PaymentProvider.Mollie]: 'Via Mollie',
                [PaymentProvider.Stripe]: '',
            });

        case PaymentMethod.iDEAL:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: 'Via Buckaroo',
                [PaymentProvider.Mollie]: 'Via Mollie',
                [PaymentProvider.Stripe]: '',
            });
        case PaymentMethod.CreditCard:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: 'Via Buckaroo',
                [PaymentProvider.Mollie]: 'Via Mollie',
                [PaymentProvider.Stripe]: '',
            });
        case PaymentMethod.Unknown: return '';
        case PaymentMethod.DirectDebit: return $t('Betalingen duren tot 5 werkdagen, geen onmiddellijke bevestiging van betaling. Mislukte betalingen kunnen kosten met zich meebrengen.');
        case PaymentMethod.PointOfSale: return $t('f511ce18-7a60-4fe8-8695-16216ffb7bdc');
    }
}

function getPaymentMethod(method: PaymentMethod) {
    return props.config.paymentMethods.includes(method);
}

function setPaymentMethod(method: PaymentMethod, enabled: boolean, force = false) {
    if (enabled === getPaymentMethod(method)) {
        return;
    }

    const arr = new PatchableArray<PaymentMethod, PaymentMethod, PaymentMethod>();
    if (enabled) {
        const errorMessage = getEnableErrorMessage(method);
        if (!force && props.choices === null && errorMessage) {
            new Toast(errorMessage, 'error red').setHide(15 * 1000).show();
            return;
        }
        arr.addPut(method);
    }
    else {
        if (!force && props.choices === null && props.config.paymentMethods.length === 1) {
            new Toast('Je moet minimaal één betaalmethode accepteren', 'error red').show();
            return;
        }

        arr.addDelete(method);
    }

    patchConfig(PaymentConfiguration.patch({
        paymentMethods: arr,
    }));
}

function canEnablePaymentMethod(method: PaymentMethod) {
    const errorMessage = getEnableErrorMessage(method);
    return props.choices !== null || !errorMessage;
}

const hasMollieOrBuckaroo = computed(() => {
    return organization.value.privateMeta?.buckarooSettings !== null || !!organization.value.privateMeta?.mollieOnboarding?.canReceivePayments;
});

const mollieOrBuckarooName = computed(() => {
    if (organization.value.privateMeta?.buckarooSettings !== null) {
        return 'Buckaroo';
    }
    return 'Mollie';
});

function getEnableErrorMessage(paymentMethod: PaymentMethod): string | undefined {
    if (paymentMethod === PaymentMethod.Unknown || paymentMethod === PaymentMethod.Transfer || paymentMethod === PaymentMethod.PointOfSale) {
        return;
    }

    if (organization.value.privateMeta?.getPaymentProviderFor(paymentMethod, stripeAccountObject.value?.meta)) {
        return;
    }

    if (organization.value.privateMeta?.buckarooSettings?.paymentMethods.includes(paymentMethod)) {
        return;
    }

    switch (paymentMethod) {
        case PaymentMethod.Payconiq: {
            if ((organization.value.privateMeta?.payconiqApiKey ?? '').length === 0) {
                return 'Je moet eerst Payconiq activeren via de betaalinstellingen (Instellingen > Betaalmethodes). Daar vind je ook meer informatie.';
            }
            break;
        }

        case PaymentMethod.iDEAL:
        case PaymentMethod.CreditCard:
        case PaymentMethod.DirectDebit:
        case PaymentMethod.Bancontact: {
            if (stripeAccountObject.value) {
                return PaymentMethodHelper.getNameCapitalized(paymentMethod) + ' is nog niet geactiveerd door Stripe. Kijk na of alle nodige informatie is ingevuld in jullie Stripe dashboard. Vaak is het probleem dat het adres van één van de bestuurders ontbreekt in Stripe of de websitelink van de vereniging niet werd ingevuld.';
            }
            break;
        }
    }

    return $t('253a60ce-cba7-4679-863c-494609d03e8f', { paymentMethod: PaymentMethodHelper.getName(paymentMethod) });
}

// Administration cost
const fixed = computed({
    get: () => {
        return props.config.administrationFee.fixed;
    },
    set: (value) => {
        patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                fixed: Math.max(0, value),
            }),
        }));
    },
});

const percentage = computed({
    get: () => {
        return props.config.administrationFee.percentage;
    },
    set: (value) => {
        patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                percentage: Math.min(10000, Math.max(0, value)),
            }),
        }));
    },
});

const zeroIfZero = computed({
    get: () => {
        return props.config.administrationFee.zeroIfZero;
    },
    set: (value) => {
        patchConfig(PaymentConfiguration.patch({
            administrationFee: AdministrationFeeSettings.patch({
                zeroIfZero: value,
            }),
        }));
    },
});

const exampleAdministrationFeeValue1 = 500;
const exampleAdministrationFee1 = computed(() => {
    return props.config.administrationFee.calculate(exampleAdministrationFeeValue1);
});

const exampleAdministrationFeeValue2 = computed(() => {
    if (zeroIfZero.value) {
        return 0;
    }
    return 1000;
});

const exampleAdministrationFee2 = computed(() => {
    return props.config.administrationFee.calculate(exampleAdministrationFeeValue2.value);
});

const transferTypes = computed(() => {
    return [
        {
            value: TransferDescriptionType.Structured,
            name: $t('f22ff741-6a05-4b15-aa6a-16e3a197ac99'),
            description: 'Willekeurig aangemaakt.',
        },
        {
            value: TransferDescriptionType.Reference,
            name: props.type === 'registration' ? 'Naam van lid/leden' : 'Bestelnummer',
            description: 'Eventueel voorafgegaan door een zelf gekozen woord (zie onder)',
        },
        {
            value: TransferDescriptionType.Fixed,
            name: 'Vaste mededeling',
            description: props.type === 'registration'
                ? 'Altijd dezelfde mededeling voor alle inschrijvingen. Een betaling kan voor meerdere inschrijvingen tegelijk zijn.'
                : 'Altijd dezelfde mededeling voor alle bestellingen.',

        },
    ];
});

const transferType = computed({
    get: () => {
        return props.config.transferSettings.type;
    },
    set: (value: TransferDescriptionType) => {
        patchConfig(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                type: value,
            }),
        }));
    },
});

const creditor = computed({
    get: () => {
        return props.config.transferSettings.creditor;
    },
    set: (creditor: string | null) => {
        patchConfig(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                creditor: !creditor || creditor.length === 0 || creditor === organization.value.name ? null : creditor,
            }),
        }));
    },
});

const iban = computed({
    get: () => {
        return props.config.transferSettings.iban;
    },
    set: (iban: string | null) => {
        patchConfig(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                iban: !iban || iban.length === 0 ? null : iban,
            }),
        }));
    },
});

const prefix = computed({
    get: () => {
        return props.config.transferSettings.prefix;
    },
    set: (prefix: string | null) => {
        patchConfig(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                prefix,
            }),
        }));
    },
});

const transferExample = computed(() => {
    const fakeReference = props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : '152';
    const settings = props.config.transferSettings;

    return settings.generateDescription(fakeReference, organization.value.address.country, {
        nr: props.type === 'registration' ? '' : fakeReference,
        email: props.type === 'registration' ? '' : $t('245e4d9b-3b80-42f5-8503-89a480995f0e').toString(),
        phone: props.type === 'registration' ? '' : $t('0c3689c1-01f8-455a-a9b0-8f766c03b2d3').toString(),
        name: props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : $t('bb910a6c-ec64-46d8-bebb-c3b4312bbfb4').toString(),
        naam: props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : $t('bb910a6c-ec64-46d8-bebb-c3b4312bbfb4').toString(),
    });
});

</script>
