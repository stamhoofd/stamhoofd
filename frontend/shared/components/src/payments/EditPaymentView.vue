<template>
    <CategorizedView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="saving" @save="save">
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
            <p v-else>
                {{ $t('%5J') }}
            </p>

            <p v-if="shouldVatExcempt" class="warning-box">
                {{ $t('%1Kh') }}
            </p>

            <SelectBalanceItemsList :items="balanceItems" :list="patchedPayment.balanceItemPayments" :is-payable="false" @patch="addPatch({balanceItemPayments: $event})" />

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

        <CategorizedBox v-if="availableMethods.includes(payment.method)" :icon="status === 'Succeeded' ? 'success' : 'clock'" :title="$t('%1Ml')">
            <template #summary>
                <p class="style-description-small">
                    {{ PaymentMethodHelper.getNameCapitalized(method) }}
                </p>

                <p class="style-description-small">
                    {{ PaymentStatusHelper.getNameCapitalized(status) }}
                </p>
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
                    <STInputBox v-if="status === 'Succeeded'" :title="type === PaymentType.Reallocation ? $t('%7R') : (type === PaymentType.Payment ? $t(`%h0`) : $t(`%h1`))" error-fields="paidAt" :error-box="errors.errorBox">
                        <DateSelection v-model="paidAt" />
                    </STInputBox>
                </div>
            </div>
            <p v-if="isNew" class="style-description-small" v-text="capitalizeFirstLetter(PaymentTypeHelper.getDescription(type))" />

            <div v-if="!isNew || type !== PaymentType.Reallocation" class="split-inputs">
                <STInputBox v-if="type !== PaymentType.Reallocation" :title="type === PaymentType.Payment ? $t(`%M7`) : $t(`%gz`)" error-fields="method" :error-box="errors.errorBox">
                    <Dropdown v-model="method">
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ PaymentMethodHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox error-fields="status" :error-box="errors.errorBox" :title="$t(`%1A`)">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ PaymentStatusHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
        </CategorizedBox>

        <CategorizedBox v-if="method === PaymentMethod.Transfer && type !== PaymentType.Reallocation" icon="bank" :title="type === PaymentType.Payment ? $t('%gs') : $t('%gt') ">
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
            <template v-if="patchedPayment.customer" #summary>
                <p v-if="patchedPayment.customer.company" class="style-description-small">
                    {{ patchedPayment.customer.company.name }}
                </p>

                <p v-else class="style-description-small">
                    {{ patchedPayment.customer.name }}
                </p>
            </template>

            <p v-if="patchedPayment.payingOrganization" class="info-box icon link selectable" @click="choosePayingOrganization">
                <span>{{ $t('%1Kf', {name: patchedPayment.payingOrganization.name, uri: patchedPayment.payingOrganization.uri}) }}</span>
                <span class="button icon edit" />
            </p>

            <p v-else-if="balanceItems.find(b => b.payingOrganizationId)" class="info-box icon link selectable" @click="choosePayingOrganization">
                <span>{{ $t('%1Kg') }}</span>
                <span class="button icon edit" />
            </p>

            <PaymentCustomerSelectionBox :customer="patchedPayment.customer" :validator="errors.validator" :error-box="errors.errorBox" :customers="customerSuggestions" @patch:customer="addPatch({customer: $event})" />
        </CategorizedBox>
    </CategorizedView>
</template>

<script lang="ts" setup>
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePop, usePresent } from '@simonbackx/vue-app-navigation';
import { I18nController } from '@stamhoofd/frontend-i18n/I18nController';
import type { BalanceItem, Organization, PaymentGeneral} from '@stamhoofd/structures';
import { BalanceItemRelationType, PaymentCustomer, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, TransferSettings } from '@stamhoofd/structures';

import { Formatter } from '@stamhoofd/utility';
import { computed, onMounted, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import { useOrganization, usePatch } from '../hooks';
import IconContainer from '../icons/IconContainer.vue';
import DateSelection from '../inputs/DateSelection.vue';
import Dropdown from '../inputs/Dropdown.vue';
import IBANInput from '../inputs/IBANInput.vue';
import STInputBox from '../inputs/STInputBox.vue';
import { CategorizedBox, CategorizedView } from '../layout';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import SearchOrganizationView from '../members/SearchOrganizationView.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import { Toast } from '../overlays/Toast';
import type { NavigationActions } from '../types/NavigationActions';
import PaymentCustomerSelectionBox from './components/PaymentCustomerSelectionBox.vue';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

const props = withDefaults(
    defineProps<{
        customers?: PaymentCustomer[];
        payment: PaymentGeneral;
        balanceItems: BalanceItem[];
        isNew?: boolean;
        saveHandler: ((patch: AutoEncoderPatchType<PaymentGeneral>) => Promise<void>);
        createBalanceItem?: null | (() => Promise<void>);
    }>(), {
        isNew: false,
        createBalanceItem: null,
        customers: () => [],
    });

const { patched: patchedPayment, addPatch, hasChanges, patch } = usePatch(props.payment);
const organization = useOrganization();
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const present = usePresent();
const customerSuggestions = computed(() => patchedPayment.value.payingOrganization ? [...props.customers, ...patchedPayment.value.payingOrganization.defaultCompanies.map(company => PaymentCustomer.create({ company }))] : props.customers);

async function choosePayingOrganization() {
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(SearchOrganizationView, {
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

function autoUpdateType() {
    const v = total.value;
    if (v === 0 && type.value !== PaymentType.Reallocation) {
        type.value = PaymentType.Reallocation;
        new Toast($t('%1I1'), 'wand theme-secundary').show();
        return true;
    }
    if (v > 0 && type.value !== PaymentType.Payment) {
        type.value = PaymentType.Payment;
        new Toast($t('%1I2'), 'receive').show();
        return true;
    }
    if (v < 0 && type.value !== PaymentType.Refund) {
        type.value = PaymentType.Refund;
        new Toast($t('%1I3'), 'undo theme-error').show();
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
        // Set transfer settings default
        updateMethod(props.payment.method);
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
        }
        else {
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
    }
    else {
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
        });
    },
});

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
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
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
