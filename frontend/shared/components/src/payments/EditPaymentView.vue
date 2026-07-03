<template>
    <CategorizedView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" data-testid="edit-payment-view" :loading="saving" :save-text="isOnlineRefund ? $t('Terugbetalen') : undefined" @save="save">
        <STErrorsDefault :error-box="errors.errorBox" />

        <CategorizedBox v-if="isNew" icon="box" :title=" $t('%gu')">
            <template #summary>
                <p class="style-description-small">
                    {{ formatPrice(patchedPayment.calculatedPrice) }}
                </p>

                <p class="style-description-small">
                    {{ pluralText(patchedPayment.balanceItemPayments.length, $t('%1Li'), $t('%1Lj')) }}
                </p>
            </template>

            <p v-if="patchedPayment.type === PaymentType.Payment">
                {{ $t('%gv') }}
            </p>
            <p v-else-if="patchedPayment.type === PaymentType.Reallocation">
                {{ $t('%gw') }}
            </p>
            <p v-else-if="onlineRefundAvailable">
                {{ $t('Kies hieronder wat er precies terugbetaald (negatief bedrag invullen) werd.') }}
            </p>
            <p v-else>
                {{ $t('%5J') }}
            </p>

            <p v-if="shouldVatExcempt" class="warning-box">
                {{ $t('%1Kh') }}
            </p>

            <SelectBalanceItemsList :items="balanceItems" :list="patchedPayment.balanceItemPayments" :is-payable="false" :get-full-price="getFullPrice ?? undefined" @patch="addPatch({balanceItemPayments: $event})" />

            <STList v-if="createBalanceItem">
                <STListItem :selectable="true" element-name="button" @click="createBalanceItem">
                    <template #left>
                        <IconContainer icon="box">
                            <template #aside>
                                <span class="icon add small primary" />
                            </template>
                        </IconContainer>
                    </template>
                    <h3 class="style-title-list">
                        {{ $t('%gx') }}
                    </h3>

                    <p class="style-description-small">
                        {{ $t('%gy') }}
                    </p>

                    <template #right>
                        <span class="icon arrow-right-small gray" />
                    </template>
                </STListItem>
            </STList>
        </CategorizedBox>

        <CategorizedBox v-if="isOnlineRefund || availableMethods.includes(method)" :icon="status === 'Succeeded' ? 'success' : 'clock'" :title="$t('%1Ml')">
            <template #summary>
                <p v-if="isOnlineRefund" class="style-description-small">
                    {{ $t('Online terugbetaling (automatisch)') }}
                </p>
                <template v-else>
                    <p class="style-description-small">
                        {{ PaymentMethodHelper.getNameCapitalized(method) }}
                    </p>

                    <p class="style-description-small">
                        {{ PaymentStatusHelper.getNameCapitalized(status) }}
                    </p>
                </template>
            </template>

            <div class="split-inputs">
                <div v-if="isNew">
                    <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`%1B`)">
                        <Dropdown v-model="type">
                            <option v-for="m in availableTypes" :key="m" :value="m">
                                {{ capitalizeFirstLetter(PaymentTypeHelper.getName(m)) }}
                            </option>
                        </Dropdown>
                    </STInputBox>
                </div>
                <div>
                    <STInputBox v-if="status === 'Succeeded' && !isOnlineRefund" :title="type === PaymentType.Reallocation ? $t('%7R') : (type === PaymentType.Payment ? $t(`%h0`) : $t(`%h1`))" error-fields="paidAt" :error-box="errors.errorBox">
                        <DateSelection v-model="paidAt" />
                    </STInputBox>
                </div>
            </div>
            <p v-if="isNew" class="style-description-small" v-text="capitalizeFirstLetter(PaymentTypeHelper.getDescription(type))" />

            <div v-if="!isNew || type !== PaymentType.Reallocation" class="split-inputs">
                <STInputBox v-if="type !== PaymentType.Reallocation" :title="type === PaymentType.Payment ? $t(`%M7`) : $t(`%gz`)" error-fields="method" :error-box="errors.errorBox">
                    <Dropdown v-model="methodOption">
                        <option v-if="onlineRefundAvailable" value="online">
                            {{ $t('Online terugbetaling (automatisch)') }}
                        </option>
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ PaymentMethodHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="!isOnlineRefund" error-fields="status" :error-box="errors.errorBox" :title="$t(`%1A`)">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ PaymentStatusHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <p v-if="isOnlineRefund" class="style-description-small">
                {{ $t('De terugbetaling wordt automatisch uitgevoerd door de betaalprovider. Het bedrag wordt teruggestort naar de rekening of kaart waarmee de oorspronkelijke betaling werd gedaan.') }}
            </p>
            <p v-if="!isOnlineRefund && type === PaymentType.Refund" class="style-description-small">
                {{ $t('Voor deze terugbetaalmethode moet je zelf de terugbetaling uitvoeren naast de registratie in Stamhoofd.') }}
            </p>
        </CategorizedBox>

        <CategorizedBox v-if="isOnlineRefund" icon="card" :title="$t('Terugbetalen via')">
            <template #summary>
                <p v-if="selectedSourcePayment" class="style-description-small">
                    {{ selectedSourcePayment.title }}
                </p>
            </template>

            <p>{{ $t('Kies de online betaling die (gedeeltelijk) wordt terugbetaald.') }}</p>

            <STList>
                <STListItem v-for="candidate of refundablePayments" :key="candidate.id" element-name="label" :selectable="true">
                    <template #left>
                        <Radio v-model="selectedSourcePaymentId" :value="candidate.id" />
                    </template>

                    <h3 class="style-title-list">
                        {{ candidate.title }}
                    </h3>
                    <p v-if="candidate.paidAt" class="style-description-small">
                        {{ $t('Betaald op {date}', {date: formatDate(candidate.paidAt)}) }}
                    </p>
                    <p v-if="candidate.iban" class="style-description-small">
                        {{ Formatter.iban(candidate.iban) }}
                    </p>
                    <p v-if="candidate.ibanName" class="style-description-small">
                        {{ $t('%hK', {name: candidate.ibanName}) }}
                    </p>

                    <p v-if="candidate.settlement" class="style-definition-text">
                        {{ $t('Uitbetaald op {date}', {name: formatDate(candidate.settlement.settledAt)}) }}
                    </p>

                    <p class="style-description-small">
                        {{ $t('Nog maximaal {price} terug te betalen', {price: formatPrice(getRemainingAmount(candidate))}) }}
                    </p>

                    <template #right>
                        <span class="style-price-base">{{ formatPrice(candidate.price) }}</span>
                    </template>
                </STListItem>
            </STList>
        </CategorizedBox>

        <CategorizedBox v-if="method === PaymentMethod.Transfer && type !== PaymentType.Reallocation && !isOnlineRefund" icon="bank" :title="type === PaymentType.Payment ? $t('%gs') : $t('%gt') ">
            <template #summary>
                <p class="style-description-small">
                    {{ iban || creditor }}
                </p>

                <p class="style-description-small">
                    {{ transferDescription }}
                </p>
            </template>

            <STInputBox :title="type === PaymentType.Payment ? $t(`%J5`) : $t(`%h2`)" error-fields="transferSettings.creditor" :error-box="errors.errorBox">
                <input v-model="creditor" class="input" type="text" autocomplete="off" :placeholder="$t(`%h3`)">
            </STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="false" :title="$t(`%J6`)" :placeholder="$t(`%h4`)" />

            <STInputBox error-fields="transferDescription" :error-box="errors.errorBox" :title="$t(`%J8`)">
                <input ref="firstInput" v-model="transferDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`%h5`)">
            </STInputBox>
        </CategorizedBox>

        <CategorizedBox icon="company" :title="$t('%1Ke')">
            <template v-if="displayedCustomer" #summary>
                <p v-if="displayedCustomer.company" class="style-description-small">
                    {{ displayedCustomer.company.name }}
                </p>

                <p v-else class="style-description-small">
                    {{ displayedCustomer.name }}
                </p>
            </template>

            <template v-if="isOnlineRefund && selectedSourcePayment?.customer">
                <p class="info-box">
                    {{ $t('De facturatiegegevens van de originele betaling worden overgenomen op de terugbetaling. Zo blijft onder andere het BTW-nummer hetzelfde als op de betaling die wordt terugbetaald.') }}
                </p>

                <STList class="info">
                    <STListItem v-if="displayedCustomer?.company">
                        <h3 class="style-definition-label">
                            {{ $t('%1JI') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ displayedCustomer.company.name }}
                        </p>
                    </STListItem>

                    <STListItem v-if="displayedCustomer?.company?.VATNumber">
                        <h3 class="style-definition-label">
                            {{ $t('%1CK') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ displayedCustomer.company.VATNumber }}
                        </p>
                    </STListItem>

                    <STListItem v-if="!displayedCustomer?.company || displayedCustomer?.name">
                        <h3 class="style-definition-label">
                            {{ $t('%1Kl') }}
                        </h3>
                        <p class="style-definition-text">
                            {{ displayedCustomer?.name || $t('%CL') }}
                        </p>
                    </STListItem>
                </STList>
            </template>
            <template v-else>
                <p v-if="patchedPayment.payingOrganization" class="info-box icon link selectable" @click="choosePayingOrganization">
                    <span>{{ $t('%1Kf', {name: patchedPayment.payingOrganization.name, uri: patchedPayment.payingOrganization.uri}) }}</span>
                    <span class="button icon edit" />
                </p>

                <p v-else-if="balanceItems.find(b => b.payingOrganizationId)" class="info-box icon link selectable" @click="choosePayingOrganization">
                    <span>{{ $t('%1Kg') }}</span>
                    <span class="button icon edit" />
                </p>

                <PaymentCustomerSelectionBox :customer="patchedPayment.customer" :validator="errors.validator" :error-box="errors.errorBox" :customers="customerSuggestions" @patch:customer="addPatch({customer: $event})" />
            </template>
        </CategorizedBox>
    </CategorizedView>
</template>

<script lang="ts" setup>
import { ErrorBox } from '#errors/ErrorBox';
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors';
import { GlobalEventBus } from '#EventBus.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization';
import { usePatch } from '#hooks/usePatch';
import IconContainer from '#icons/IconContainer.vue';
import DateSelection from '#inputs/DateSelection.vue';
import Dropdown from '#inputs/Dropdown.vue';
import IBANInput from '#inputs/IBANInput.vue';
import Radio from '#inputs/Radio.vue';
import STInputBox from '#inputs/STInputBox.vue';
import CategorizedBox from '#layout/categorized-view/CategorizedBox.vue';
import CategorizedView from '#layout/categorized-view/CategorizedView.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';

import { CenteredMessage } from '#overlays/CenteredMessage';
import { Toast } from '#overlays/Toast';
import type { NavigationActions } from '#types/NavigationActions';
import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { BalanceItem, Organization, Payment, PrivatePayment } from '@stamhoofd/structures';
import { BalanceItemRelationType, PaymentCustomer, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, TransferSettings } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';
import PaymentCustomerSelectionBox from './components/PaymentCustomerSelectionBox.vue';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

const props = withDefaults(
    defineProps<{
        customers?: PaymentCustomer[];
        payment: PaymentGeneral;
        balanceItems: BalanceItem[];
        isNew?: boolean;

        /**
         * Optionally called after the payment was saved (the view saves the payment itself
         * and deep sets `payment` with the saved version, which is also passed here)
         */
        saveHandler?: null | ((payment: PaymentGeneral) => void | Promise<void>);
        createBalanceItem?: null | (() => Promise<void>);

        /**
         * Online payments that can be (partially) refunded via the payment provider.
         * When creating a refund, the user can then choose to refund online instead of
         * registering a manual refund (e.g. via transfer).
         */
        refundablePayments?: PrivatePayment[];

        /**
         * Override the default (maximum) price per balance item in the selection list.
         * Used when refunding a specific payment: pass the price paid via that payment.
         */
        getFullPrice?: null | ((item: BalanceItem) => number);
    }>(), {
        isNew: false,
        saveHandler: null,
        createBalanceItem: null,
        customers: () => [],
        refundablePayments: () => [],
        getFullPrice: null,
    });

const { patched: patchedPayment, addPatch, hasChanges, patch } = usePatch(props.payment);
const organization = useOrganization();
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const present = usePresent();
const context = useContext();
const customerSuggestions = computed(() => {
    const array = patchedPayment.value.payingOrganization ? [...props.customers, ...patchedPayment.value.payingOrganization.defaultCompanies.map(company => PaymentCustomer.create({ company }))] : props.customers;

    // Remove duplicates.
    return array.filter((value, index, self) => {
        return self.findIndex(v => v.equals(value)) === index;
    });
});

async function choosePayingOrganization() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('#members/SearchOrganizationView.vue'), {
                    selectOrganization: async (organization: Organization, { dismiss }: NavigationActions) => {
                        await dismiss({ force: true });
                        addPatch({
                            payingOrganizationId: organization.id,
                            payingOrganization: organization,
                        });
                    },
                }),
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

const availableMethods = [
    PaymentMethod.Transfer,
    PaymentMethod.PointOfSale,
    PaymentMethod.Unknown,
];

const availableTypes = [
    PaymentType.Payment,
    PaymentType.Refund,
    PaymentType.Reallocation,
];

const availableStatuses = [
    PaymentStatus.Pending,
    PaymentStatus.Succeeded,
    PaymentStatus.Failed,
];
const total = computed(() => {
    return patchedPayment.value.balanceItemPayments.reduce((total, item) => total + item.price, 0);
});

function autoUpdateType(showToast = true) {
    const v = total.value;
    if (v === 0 && type.value !== PaymentType.Reallocation) {
        type.value = PaymentType.Reallocation;

        if (showToast) {
            new Toast($t('%1I1'), 'wand theme-secundary').show();
        }
        return true;
    }
    if (v > 0 && type.value !== PaymentType.Payment) {
        type.value = PaymentType.Payment;
        if (showToast) {
            new Toast($t('%1I2'), 'receive').show();
        }
        return true;
    }
    if (v < 0 && type.value !== PaymentType.Refund) {
        type.value = PaymentType.Refund;
        if (showToast) {
            new Toast($t('%1I3'), 'undo theme-error').show();
        }
        return true;
    }
}

const title = computed(() => {
    if (props.isNew) {
        return `${Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(patchedPayment.value.type))} registreren`;
    }
    return `${Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(patchedPayment.value.type))} aanpassen`;
});

const method = computed({
    get: () => patchedPayment.value.method ?? PaymentMethod.Unknown,
    set: (method: PaymentMethod) => {
        if (method === patchedPayment.value.method) {
            return;
        }
        addPatch({
            method,
        });
        updateMethod(method);
    },
});

onMounted(() => {
    if (props.isNew) {
        autoUpdateType(false);

        // Set transfer settings default
        updateMethod(props.payment.method);

        // Prefer an online refund when available
        if (patchedPayment.value.type === PaymentType.Refund && !patchedPayment.value.reversingPaymentId && props.refundablePayments.length > 0) {
            methodOption.value = 'online';
        }
    }
});

const shouldVatExcempt = computed(() => {
    if (patchedPayment.value.customer && patchedPayment.value.customer.company && patchedPayment.value.customer.company.VATNumber && patchedPayment.value.customer.company.address) {
        if (organization.value) {
            for (const company of organization.value.meta.companies.slice(0, 3)) {
                if (company.VATNumber && company.address) {
                    // Reverse charged vat applicable?
                    if (patchedPayment.value.customer.company.address.country !== company.address.country) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
});

function updateMethod(method: PaymentMethod) {
    if (method === PaymentMethod.Transfer) {
        if (props.payment.transferDescription) {
            addPatch({
                transferDescription: props.payment.transferDescription,
                transferSettings: props.payment.transferSettings?.clone(),
            });
        } else {
            let transferSettings = organization.value?.meta.registrationPaymentConfiguration.transferSettings.fillMissing(TransferSettings.create({ creditor: organization.value.name })) ?? TransferSettings.create({ creditor: organization.value?.name });
            const webshopId = props.balanceItems.find(b => b.relations.get(BalanceItemRelationType.Webshop))?.id;
            if (webshopId) {
                const webshop = organization.value?.webshops.find(w => w.id === webshopId);
                if (webshop) {
                    transferSettings = webshop.meta.paymentConfiguration.transferSettings.fillMissing(transferSettings);
                }
            }

            addPatch({
                transferDescription: transferSettings.generateDescription('', I18nController.shared.countryCode),
                transferSettings: transferSettings,
            });
        }
    } else {
        addPatch({
            transferDescription: null,
            transferSettings: null,
        });
    }
}

const status = computed({
    get: () => patchedPayment.value.status,
    set: (status: PaymentStatus) => {
        addPatch({
            status,
            paidAt: status === PaymentStatus.Succeeded ? (props.payment.paidAt ?? new Date()) : null,
        });
    },
});

const type = computed({
    get: () => patchedPayment.value.type,
    set: (type) => {
        addPatch({
            type,
            // Only refunds can reverse another payment
            ...(type !== PaymentType.Refund ? { reversingPaymentId: null } : {}),
        });

        // Prefer an online refund when available (e.g. when the type switched automatically
        // because the total became negative)
        if (type === PaymentType.Refund && props.isNew && !patchedPayment.value.reversingPaymentId && props.refundablePayments.length > 0) {
            selectSourcePayment(props.refundablePayments[0]);
        }
    },
});

// ----- Online refunds via the payment provider -----

const onlineRefundAvailable = computed(() => props.isNew && props.refundablePayments.length > 0 && type.value === PaymentType.Refund);

/**
 * A refund that reverses another payment is executed online via the payment provider of that
 * payment. The patched payment is the single source of truth: reversingPaymentId is set (and
 * the method matches the source payment) when the user chooses an online refund.
 */
const isOnlineRefund = computed(() => props.isNew && type.value === PaymentType.Refund && !!patchedPayment.value.reversingPaymentId);

/**
 * The method dropdown model: 'online' or a manual payment method
 */
const methodOption = computed({
    get: () => isOnlineRefund.value ? 'online' as const : method.value,
    set: (value: 'online' | PaymentMethod) => {
        if (value === 'online') {
            const source = selectedSourcePayment.value ?? props.refundablePayments[0] ?? null;
            if (source) {
                selectSourcePayment(source);
            }
            return;
        }
        addPatch({ reversingPaymentId: null });
        method.value = value;
    },
});

const selectedSourcePayment = computed(() => props.refundablePayments.find(p => p.id === patchedPayment.value.reversingPaymentId) ?? null);

const selectedSourcePaymentId = computed({
    get: () => patchedPayment.value.reversingPaymentId ?? '',
    set: (id: string) => {
        const source = props.refundablePayments.find(p => p.id === id);
        if (source) {
            selectSourcePayment(source);
        }
    },
});

function selectSourcePayment(source: Payment) {
    addPatch({ reversingPaymentId: source.id });

    // The refund is executed via the source payment, so it uses the same payment method
    method.value = source.method;
}

/**
 * The customer that will be stored on the payment. For online refunds the customer of the
 * payment that is being refunded is reused, so the VAT number cannot change between the
 * payment and the refund.
 */
const displayedCustomer = computed(() => {
    if (isOnlineRefund.value && selectedSourcePayment.value?.customer) {
        return selectedSourcePayment.value.customer;
    }
    return patchedPayment.value.customer;
});

/**
 * The amount that can still be refunded via this payment
 * (note: refundedAmount and pendingRefundAmount are negative)
 */
function getRemainingAmount(payment: Payment) {
    return payment.price + payment.refundedAmount + payment.pendingRefundAmount;
}

/**
 * Validate the online refund and ask for confirmation (creating a refund at the payment
 * provider cannot be undone). Returns false when the user cancelled.
 */
async function validateOnlineRefund(): Promise<boolean> {
    const sourcePayment = selectedSourcePayment.value;
    if (!sourcePayment) {
        throw new SimpleError({
            code: 'missing_field',
            message: $t('Kies de betaling die je wilt terugbetalen.'),
        });
    }

    if (-total.value > getRemainingAmount(sourcePayment)) {
        throw new SimpleError({
            code: 'refund_amount_too_high',
            message: $t('Het terug te betalen bedrag ({amount}) is hoger dan wat er nog terugbetaald kan worden via de gekozen betaling ({remaining}). Kies een andere betaling of registreer een manuele terugbetaling.', {
                amount: Formatter.price(-total.value),
                remaining: Formatter.price(getRemainingAmount(sourcePayment)),
            }),
        });
    }

    return await CenteredMessage.confirm(
        $t('Ben je zeker dat je {price} wilt terugbetalen via {method}?', {
            price: Formatter.price(-total.value),
            method: PaymentMethodHelper.getName(sourcePayment.method),
        }),
        $t('Ja, terugbetalen'),
        $t('Dit kan niet ongedaan gemaakt worden.'),
    );
}

const paidAt = computed({
    get: () => patchedPayment.value.paidAt ?? new Date(),
    set: (paidAt: Date) => {
        addPatch({
            paidAt,
        });
    },
});

const transferDescription = computed({
    get: () => patchedPayment.value.transferDescription ?? '',
    set: (transferDescription: string) => {
        addPatch({
            transferDescription,
        });
    },
});

const creditor = computed({
    get: () => patchedPayment.value.transferSettings?.creditor ?? '',
    set: (creditor: string) => {
        addPatch({
            transferSettings: TransferSettings.patch({
                creditor,
            }),
        });
    },
});

const iban = computed({
    get: () => patchedPayment.value.transferSettings?.iban ?? '',
    set: (iban: string) => {
        addPatch({
            transferSettings: TransferSettings.patch({
                iban,
            }),
        });
    },
});

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;
    try {
        errors.errorBox = null;
        if (!await errors.validator.validate()) {
            return;
        }
        if (autoUpdateType()) {
            return;
        }

        if (isOnlineRefund.value && !await validateOnlineRefund()) {
            return;
        }

        const arr: PatchableArrayAutoEncoder<PaymentGeneral> = new PatchableArray();
        if (props.isNew) {
            arr.addPut(patchedPayment.value);
        } else {
            arr.addPatch(patch.value);
        }

        const response = await context.value.authenticatedServer.request({
            method: 'PATCH',
            path: '/organization/payments',
            body: arr,
            decoder: new ArrayDecoder(PaymentGeneral as Decoder<PaymentGeneral>),
            shouldRetry: false,
        });

        const savedPayment = response.data[0];
        if (savedPayment) {
            props.payment.deepSet(savedPayment);
        }

        GlobalEventBus.sendEvent('paymentPatch', props.payment).catch(console.error);

        if (isOnlineRefund.value) {
            if (props.payment.isPending) {
                Toast.success($t('De terugbetaling werd aangemaakt en is in verwerking bij de betaalprovider. Het kan tot enkele werkdagen duren voor de terugbetaling wordt uitgevoerd.')).show();
            } else {
                Toast.success($t('De terugbetaling werd aangemaakt.')).show();
            }
        }

        if (props.saveHandler) {
            await props.saveHandler(props.payment);
        }
        await pop({ force: true });
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    } finally {
        saving.value = false;
    }
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};
defineExpose({
    shouldNavigateAway,
});
</script>
