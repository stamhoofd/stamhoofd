<template>
    <LoadingBoxTransition :loading="loadingStripeAccounts">
        <div class="container">
            <STErrorsDefault :error-box="errors.errorBox" />
            <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" error-fields="stripeAccountId" :title="$t(`217f3390-3eef-4f35-bd23-ab3c155f2622`)">
                <Dropdown v-model="stripeAccountId">
                    <option v-if="hasMollieOrBuckaroo" :value="null">
                        {{ mollieOrBuckarooName }}
                    </option>
                    <option v-else :value="null">
                        {{ $t('45ff02db-f404-4d91-853f-738d55c40cb6') }}
                    </option>
                    <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                        {{ account.meta.settings.dashboard.display_name }} - {{ account.meta.business_profile.name }}, xxxx {{ account.meta.bank_account_last4 }} - {{ account.accountId }}
                    </option>
                </Dropdown>
            </STInputBox>
            <p v-if="stripeAccountObject && stripeAccountObject.warning" :class="stripeAccountObject.warning.type + '-box'">
                {{ stripeAccountObject.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('a36700a3-64be-49eb-b1fd-60af7475eb4e') }}
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
                <hr><h2>{{ $t('be98be36-f796-4f96-b054-4d2a09be3d79') }}</h2>
                <p>{{ $t('b091538b-014e-4db2-8241-9ed98e0c51c7') }}</p>

                <div class="split-inputs">
                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`f67ccf42-d4a8-4fe6-b7dc-91f43726646e`)">
                        <PriceInput v-model="fixed" :min="0" :required="true" :placeholder="$t(`f67ccf42-d4a8-4fe6-b7dc-91f43726646e`)" />
                    </STInputBox>

                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`dd61d33b-367e-4e40-8ac6-84c286b931bc`)">
                        <PermyriadInput v-model="percentage" :required="true" :placeholder="$t(`dd61d33b-367e-4e40-8ac6-84c286b931bc`)" />
                    </STInputBox>
                </div>

                <Checkbox v-if="fixed > 0" v-model="zeroIfZero">
                    {{ $t('29c16366-9962-4b22-a8bb-55c5a8467315') }}
                </Checkbox>

                <p v-if="percentage && exampleAdministrationFee1" class="style-description-small">
                    {{ $t('76a41c36-99d1-467c-a243-3a30a56c272e', {
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
                message: $t(`45285899-60e2-42c6-bb51-fdd16fe651e4`),
            }));
            return false;
        }

        if (props.config.paymentMethods.length === 0) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'no_payment_methods',
                message: $t(`740c41c3-7f19-4a5b-bd49-7e7d228e2187`),
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
        new Toast($t(`2384baa0-50ca-4003-8d3a-af0beb18fec2`), 'error red').show();
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
                [PaymentProvider.Buckaroo]: $t(`70ee9a44-6cd7-49a1-9852-8519c23ec13a`),
            });
        case PaymentMethod.Bancontact:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`70ee9a44-6cd7-49a1-9852-8519c23ec13a`),
                [PaymentProvider.Mollie]: $t(`4db6cde7-274f-4202-9351-3e9ce82794c1`),
                [PaymentProvider.Stripe]: '',
            });

        case PaymentMethod.iDEAL:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`70ee9a44-6cd7-49a1-9852-8519c23ec13a`),
                [PaymentProvider.Mollie]: $t(`4db6cde7-274f-4202-9351-3e9ce82794c1`),
                [PaymentProvider.Stripe]: '',
            });
        case PaymentMethod.CreditCard:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`70ee9a44-6cd7-49a1-9852-8519c23ec13a`),
                [PaymentProvider.Mollie]: $t(`4db6cde7-274f-4202-9351-3e9ce82794c1`),
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
            texts.push($t(`84e54416-464f-4ca6-a685-def2a0a9c135`) + ' ' + Formatter.price(settings.minimumAmount));
        }

        if (settings.warningText) {
            if (settings.warningAmount !== null) {
                texts.push($t(`7972bd35-3bb5-4dae-9771-8d4765646f61`) + ' ' + Formatter.price(settings.warningAmount));
            }
            else {
                texts.push($t(`88edcbb7-c3b2-4531-8796-f0c6782fa76e`));
            }
        }

        if (settings.companiesOnly) {
            texts.push($t(`8bec9f71-c41d-485f-b0f5-95a40b695884`));
        }
    }

    if (paymentMethod === PaymentMethod.Transfer) {
        if (!props.config.transferSettings.iban) {
            texts.push($t(`8e243505-26f6-4505-9317-c871fa1df324`));
        }
        else {
            texts.push($t(`475a6b09-e71d-4160-a87e-d4a3844116c3`) + ' ' + props.config.transferSettings.iban);
        }

        if (props.config.transferSettings.creditor) {
            texts.push($t(`0cfac4d3-1840-4b12-b9d7-b9f40e49d664`) + ' ' + props.config.transferSettings.creditor);
        }

        texts.push($t(`e54dd641-9788-4514-b866-86f602892fb2`) + ' ' + transferTypes.value.find(t => t.value === props.config.transferSettings.type)?.name + (prefix.value && props.config.transferSettings.type !== TransferDescriptionType.Structured ? ' (' + prefix.value + ')' : ''));
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
            new Toast($t(`4df013df-328f-47b6-b90a-fc40813d3c0a`), 'error red').show();
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
        return $t(`f5fc5d6b-49ef-4b3d-80b7-90e1f81220fa`);
    }
    return $t(`b8cf0b1f-04c4-4a85-9a19-027a5326fd11`);
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
                return $t(`60bbe710-43e0-4a19-996c-ded3f25c1c39`);
            }
            break;
        }

        case PaymentMethod.iDEAL:
        case PaymentMethod.CreditCard:
        case PaymentMethod.DirectDebit:
        case PaymentMethod.Bancontact: {
            if (stripeAccountObject.value) {
                return PaymentMethodHelper.getNameCapitalized(paymentMethod) + ' ' + $t(`79cb9c3d-fe24-46cb-84bd-f1aa5fd625c5`);
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
            name: props.type === 'registration' ? $t(`1add2f6b-1c51-49f9-9fe3-a9a1ad62ad07`) : $t(`4d496edf-0203-4df3-a6e9-3e58d226d6c5`),
        },
        {
            value: TransferDescriptionType.Fixed,
            name: $t(`610a54d0-5ae5-4e4c-bac3-205fd56b65c8`),
        },
    ];
});

const prefix = computed(() => {
    return props.config.transferSettings.prefix;
});

</script>
