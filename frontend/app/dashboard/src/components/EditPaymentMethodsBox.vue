<template>
    <LoadingBoxTransition :loading="loadingStripeAccounts">
        <div class="container">
            <STErrorsDefault :error-box="errors.errorBox" />
            <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" error-fields="stripeAccountId" :title="$t(`Betaalaccount`)">
                <Dropdown v-model="stripeAccountId">
                    <option v-if="hasMollieOrBuckaroo" :value="null">
                        {{ mollieOrBuckarooName }}
                    </option>
                    <option v-else :value="null">
                        {{ $t('Geen') }}
                    </option>
                    <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                        {{ account.meta.settings.dashboard.display_name }} - {{ account.meta.business_profile.name }}, xxxx {{ account.meta.bank_account_last4 }} - {{ account.accountId }}
                    </option>
                </Dropdown>
            </STInputBox>
            <p v-if="stripeAccountObject && stripeAccountObject.warning" :class="stripeAccountObject.warning.type + '-box'">
                {{ stripeAccountObject.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('Meer info') }}
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
                    <p v-if="getPaymentMethod(method) && getDescription(method)" class="style-description-small pre-wrap" v-text="getDescription(method)" />
                    <p v-if="getPaymentMethod(method) && getSettingsDescription(method)" class="style-description-small pre-wrap" v-text="getSettingsDescription(method)" />

                    <template #right>
                        <button v-if="getPaymentMethod(method)" class="icon button settings" type="button" @click="editPaymentMethodSettings(method)" />
                    </template>
                </STListItem>
            </STList>

            <template v-if="showAdministrationFee">
                <hr><h2>{{ $t('Administratiekosten') }}</h2>
                <p>{{ $t('b091538b-014e-4db2-8241-9ed98e0c51c7') }}</p>

                <div class="split-inputs">
                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`Vaste kost`)">
                        <PriceInput v-model="fixed" :min="0" :required="true" :placeholder="$t(`Vaste kost`)" />
                    </STInputBox>

                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`Percentage`)">
                        <PermyriadInput v-model="percentage" :required="true" :placeholder="$t(`Percentage`)" />
                    </STInputBox>
                </div>

                <Checkbox v-if="fixed > 0" v-model="zeroIfZero">
                    {{ $t('Reken geen administratiekosten aan als het totaalbedrag 0 euro is') }}
                </Checkbox>

                <p v-if="percentage && exampleAdministrationFee1" class="style-description-small">
                    {{ $t('Voorbeeld: de aangerekende administratiekost bedraagt {exampleAdministrationFee1} op een bedrag van {exampleAdministrationFeeValue1}, en {exampleAdministrationFee2} op een bedrag van {exampleAdministrationFeeValue2}.', {
                        exampleAdministrationFee1: formatPrice(exampleAdministrationFee1),
                        exampleAdministrationFeeValue1: formatPrice(exampleAdministrationFeeValue1),
                        exampleAdministrationFee2: formatPrice(exampleAdministrationFee2),
                        exampleAdministrationFeeValue2: formatPrice(exampleAdministrationFeeValue2)
                    }) }}
                </p>
            </template>
        </div>
    </LoadingBoxTransition>
</template>

<script lang="ts" setup>
import { ArrayDecoder, AutoEncoderPatchType, Decoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { Checkbox, Dropdown, ErrorBox, LoadingBoxTransition, PermyriadInput, PriceInput, STErrorsDefault, STInputBox, STList, STListItem, Toast, useContext, useCountry, useErrors, useRequiredOrganization, useValidation, Validator } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { AdministrationFeeSettings, Country, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PaymentProvider, PrivatePaymentConfiguration, StripeAccount, TransferDescriptionType } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';
import EditPaymentMethodSettingsView from './EditPaymentMethodSettingsView.vue';

const props = withDefaults(defineProps<{
    type: 'registration' | 'webshop';
    showAdministrationFee?: boolean;
    validator?: Validator | null;
    privateConfig: PrivatePaymentConfiguration;
    config: PaymentConfiguration;
    choices?: PaymentMethod[] | null;
}>(), {
    showAdministrationFee: true,
    validator: null,
    choices: null,
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
const present = usePresent();

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

async function editPaymentMethodSettings(paymentMethod: PaymentMethod) {
    await present({
        components: [
            new ComponentWithProperties(EditPaymentMethodSettingsView, {
                type: props.type,
                paymentMethod,
                configuration: props.config,
                saveHandler: async (configuration: AutoEncoderPatchType<PaymentConfiguration>) => {
                    patchConfig(configuration);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

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

        // Check if online payments are enabled
        for (const p of sortedPaymentMethods.value) {
            if (!ignore.includes(p) && canEnablePaymentMethod(p)) {
                setPaymentMethod(p, true);
            }
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
    return PaymentMethodHelper.getPluralNameCapitalized(paymentMethod);
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
        case PaymentMethod.DirectDebit: return $t('f86a093f-c6ae-42d0-b5c4-4035a4d32f74');
        case PaymentMethod.PointOfSale: return $t('f511ce18-7a60-4fe8-8695-16216ffb7bdc');
    }
}

function getSettingsDescription(paymentMethod: PaymentMethod): string {
    let texts: string[] = [];
    const settings = props.config.paymentMethodSettings.get(paymentMethod);

    if (settings) {
        if (settings.minimumAmount !== 0) {
            texts.push('Vanaf minimum ' + Formatter.price(settings.minimumAmount));
        }

        if (settings.warningText) {
            if (settings.warningAmount !== null) {
                texts.push('Met waarschuwing vanaf ' + Formatter.price(settings.warningAmount));
            }
            else {
                texts.push('Met waarschuwing');
            }
        }

        if (settings.companiesOnly) {
            texts.push('Niet beschikbaar voor particulieren');
        }
    }

    if (paymentMethod === PaymentMethod.Transfer) {
        if (!props.config.transferSettings.iban) {
            texts.push('Nog geen bankrekeningnummer ingesteld');
        }
        else {
            texts.push('Rekeningnummer: ' + props.config.transferSettings.iban);
        }

        if (props.config.transferSettings.creditor) {
            texts.push('Begunstigde: ' + props.config.transferSettings.creditor);
        }

        texts.push('Mededeling: ' + transferTypes.value.find(t => t.value === props.config.transferSettings.type)?.name + (prefix.value && props.config.transferSettings.type !== TransferDescriptionType.Structured ? ' (' + prefix.value + ')' : ''));
    }

    return texts.join('\n');
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

    if (enabled && method === PaymentMethod.Transfer) {
        // Open dialog
        editPaymentMethodSettings(method).catch(console.error);
    }
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
        },
        {
            value: TransferDescriptionType.Reference,
            name: props.type === 'registration' ? 'Naam van lid/leden' : 'Bestelnummer',
        },
        {
            value: TransferDescriptionType.Fixed,
            name: 'Vaste mededeling',
        },
    ];
});

const prefix = computed(() => {
    return props.config.transferSettings.prefix;
});

</script>
