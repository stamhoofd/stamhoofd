<template>
    <LoadingBoxTransition :loading="loadingStripeAccounts">
        <div class="container">
            <STErrorsDefault :error-box="errors.errorBox" />
            <STInputBox v-if="(stripeAccountObject === null && stripeAccounts.length > 0) || stripeAccounts.length > 1 || (stripeAccounts.length > 0 && hasMollieOrBuckaroo)" error-fields="stripeAccountId" :title="$t(`%JM`)">
                <Dropdown v-model="stripeAccountId">
                    <option v-if="hasMollieOrBuckaroo" :value="null">
                        {{ mollieOrBuckarooName }}
                    </option>
                    <option v-else :value="null">
                        {{ $t('%1FW') }}
                    </option>
                    <option v-for="account in stripeAccounts" :key="account.id" :value="account.id">
                        {{ account.meta.settings.dashboard.display_name }} - {{ account.meta.business_profile.name }}, xxxx {{ account.meta.bank_account_last4 }} - {{ account.accountId }}
                    </option>
                </Dropdown>
            </STInputBox>
            <p v-if="stripeAccountObject && stripeAccountObject.warning" :class="stripeAccountObject.warning.type + '-box'">
                {{ stripeAccountObject.warning.text }}
                <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
                    {{ $t('%19t') }}
                </a>
            </p>

            <p v-if="!getPaymentMethod(PaymentMethod.Bancontact) && getPaymentMethod(PaymentMethod.Payconiq)" :class="'warning-box'">
                {{ $t("We raden het gebruik van Payconiq af. Het is tijd om over te schakelen en Bancontact te gebruiken. Dit is veel stabieler en geeft minder problemen.") }}
                <a :href="$domains.getDocs('payconiq')" target="_blank" class="button text">
                    {{ $t('%19t') }}
                </a>
            </p>

            <p v-if="getPaymentMethod(PaymentMethod.Bancontact) && getPaymentMethod(PaymentMethod.Payconiq)" :class="'warning-box'">
                {{ $t("Je kan Payconiq (nu Bancontact Pay | Wero) niet langer combineren met Bancontact. Bancontact is nu voldoende.") }}
                <a :href="$domains.getDocs('payconiq')" target="_blank" class="button text">
                    {{ $t('%19t') }}
                </a>
            </p>

            <STList>
                <STListItem v-for="method in sortedPaymentMethods" :key="method" :selectable="true" element-name="label" :class="{'left-center': !(getPaymentMethod(method) && (getDescription(method) || getSettingsDescription(method)))}" @click="canEnablePaymentMethod(method) ? undefined : setPaymentMethod(method, true)">
                    <template #left>
                        <Checkbox :model-value="getPaymentMethod(method)" :disabled="!canEnablePaymentMethod(method)" @update:model-value="setPaymentMethod(method, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ getName(method) }}
                    </h3>
                    <p v-if="getPaymentMethod(method) && getDescription(method)" class="style-description-small pre-wrap" v-text="getDescription(method)" />
                    <p v-if="getPaymentMethod(method) && getSettingsDescription(method)" class="style-description-small pre-wrap" v-text="getSettingsDescription(method)" />

                    <template v-if="!canEnablePaymentMethod(method)" #right>
                        <button class="button text selected" type="button" @click.stop="openPaymentSettings">
                            <span>{{ $t('Activeren') }}</span>
                            <span class="icon arrow-right-small" />
                        </button>
                    </template>
                </STListItem>
            </STList>

            <template v-if="showAdministrationFee">
                <hr><h2>{{ $t('%xK') }}</h2>
                <p>{{ $t('%1') }}</p>

                <div class="split-inputs">
                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`%JN`)">
                        <PriceInput v-model="fixed" :min="0" :required="true" :placeholder="$t(`%JN`)" />
                    </STInputBox>

                    <STInputBox error-fields="administrationFee.fixed" :error-box="errors.errorBox" :title="$t(`%2I`)">
                        <PermyriadInput v-model="percentage" :required="true" :placeholder="$t(`%2I`)" />
                    </STInputBox>
                </div>

                <Checkbox v-if="fixed > 0" v-model="zeroIfZero">
                    {{ $t('%JL') }}
                </Checkbox>

                <p v-if="percentage && exampleAdministrationFee1" class="style-description-small">
                    {{ $t('%14F', {
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
import type { AutoEncoderPatchType, Decoder} from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import LoadingBoxTransition from '@stamhoofd/components/containers/LoadingBoxTransition.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox.ts';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { useValidation } from '@stamhoofd/components/errors/useValidation.ts';
import type { Validator } from '@stamhoofd/components/errors/Validator.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext.ts';
import { useCountry } from '@stamhoofd/components/hooks/useCountry.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
import Checkbox from '@stamhoofd/components/inputs/Checkbox.vue';
import Dropdown from '@stamhoofd/components/inputs/Dropdown.vue';
import PermyriadInput from '@stamhoofd/components/inputs/PermyriadInput.vue';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import STInputBox from '@stamhoofd/components/inputs/STInputBox.vue';
import STList from '@stamhoofd/components/layout/STList.vue';
import STListItem from '@stamhoofd/components/layout/STListItem.vue';
import { Toast, ToastButton } from '@stamhoofd/components/overlays/Toast.ts';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { AdministrationFeeSettings, PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PaymentProvider, PrivatePaymentConfiguration, StripeAccount, TransferDescriptionType } from '@stamhoofd/structures';
import { Country } from "@stamhoofd/types/Country";
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed, nextTick, ref } from 'vue';
import PaymentSettingsView from '../views/dashboard/settings/PaymentSettingsView.vue';

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
                message: $t(`%JO`),
            }));
            return false;
        }

        if (props.config.paymentMethods.length === 0) {
            errors.errorBox = new ErrorBox(new SimpleError({
                code: 'no_payment_methods',
                message: $t(`%JP`),
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

async function openPaymentSettings() {
    await present({
        components: [
            // todo: test
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(PaymentSettingsView, {}),
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
        else {
            if (stripeAccountId.value && stripeAccounts.value.length === 0) {
                stripeAccountId.value = null;
            }
        }

        nextTick().finally(() => {
            setDefaultSelection();
        }).catch(console.error);
    }
    catch (e) {
        console.error(e);
        new Toast($t(`%JQ`), 'error red').show();
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
            // Enable point of sale
            setPaymentMethod(PaymentMethod.PointOfSale, true);
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
    r.push(PaymentMethod.Bancontact);

    // Force a given ordering
    if ((country.value === Country.Belgium && canEnablePaymentMethod(PaymentMethod.Payconiq)) || getPaymentMethod(PaymentMethod.Payconiq)) {
        // Disable Payconiq if Bancontact is enabled
        if (!canEnablePaymentMethod(PaymentMethod.Bancontact) || getPaymentMethod(PaymentMethod.Payconiq)) {
            // Only allowed as legacy fallover
            r.push(PaymentMethod.Payconiq);
        }
    }

    r.push(PaymentMethod.CreditCard);

    // Force a given ordering
    if (country.value != Country.Netherlands) {
        r.push(PaymentMethod.iDEAL);
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
        case PaymentMethod.Transfer: return $t('%5O');
        case PaymentMethod.Payconiq:
            return providerText(provider, {
                [PaymentProvider.Payconiq]: '',
                [PaymentProvider.Buckaroo]: $t(`%1F`),
            });
        case PaymentMethod.Bancontact:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`%1F`),
                [PaymentProvider.Mollie]: $t(`%w`),
                [PaymentProvider.Stripe]: '',
            });

        case PaymentMethod.iDEAL:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`%1F`),
                [PaymentProvider.Mollie]: $t(`%w`),
                [PaymentProvider.Stripe]: '',
            });
        case PaymentMethod.CreditCard:
            return providerText(provider, {
                [PaymentProvider.Buckaroo]: $t(`%1F`),
                [PaymentProvider.Mollie]: $t(`%w`),
                [PaymentProvider.Stripe]: '',
            });
        case PaymentMethod.Unknown: return '';
        case PaymentMethod.DirectDebit: return $t('%74');
        case PaymentMethod.PointOfSale: return $t('%5Z');
    }
}

function getSettingsDescription(paymentMethod: PaymentMethod): string {
    const texts: string[] = [];
    const settings = props.config.paymentMethodSettings.get(paymentMethod);

    if (settings) {
        if (settings.minimumAmount !== 0) {
            texts.push($t(`%JR`) + ' ' + Formatter.price(settings.minimumAmount));
        }

        if (settings.warningText) {
            if (settings.warningAmount !== null) {
                texts.push($t(`%JS`) + ' ' + Formatter.price(settings.warningAmount));
            }
            else {
                texts.push($t(`%JT`));
            }
        }

        if (settings.companiesOnly) {
            texts.push($t(`%JU`));
        }
    }

    if (paymentMethod === PaymentMethod.Transfer) {
        if (!props.config.transferSettings.iban) {
            texts.push($t(`%JV`));
        }
        else {
            texts.push($t(`%JW`) + ' ' + props.config.transferSettings.iban);
        }

        if (props.config.transferSettings.creditor) {
            texts.push($t(`%JX`) + ' ' + props.config.transferSettings.creditor);
        }

        texts.push($t(`%JY`) + ' ' + transferTypes.value.find(t => t.value === props.config.transferSettings.type)?.name + (prefix.value && props.config.transferSettings.type !== TransferDescriptionType.Structured ? ' (' + prefix.value + ')' : ''));
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
            const toast = new Toast(errorMessage, 'error red');

            toast.setButton(new ToastButton('Open instellingen', () => {
                openPaymentSettings().catch(console.error);
            }, 'settings'));

            toast.setHide(15 * 1000).show();
            return;
        }
        arr.addPut(method);
    }
    else {
        if (!force && props.choices === null && props.config.paymentMethods.length === 1) {
            new Toast($t(`%JZ`), 'error red').show();
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
        return $t(`%2Q`);
    }
    return $t(`%1x`);
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
                return $t(`%Ja`);
            }
            break;
        }

        case PaymentMethod.iDEAL:
        case PaymentMethod.CreditCard:
        case PaymentMethod.DirectDebit:
        case PaymentMethod.Bancontact: {
            if (stripeAccountObject.value) {
                return $t(`%14e`, { paymentMethod: PaymentMethodHelper.getNameCapitalized(paymentMethod) });
            }
            break;
        }
    }

    return $t('%3s', { paymentMethod: PaymentMethodHelper.getName(paymentMethod) });
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
            name: $t('%2z'),
        },
        {
            value: TransferDescriptionType.Reference,
            name: props.type === 'registration' ? $t(`%JG`) : $t(`%xA`),
        },
        {
            value: TransferDescriptionType.Fixed,
            name: $t(`%JI`),
        },
    ];
});

const prefix = computed(() => {
    return props.config.transferSettings.prefix;
});

</script>
