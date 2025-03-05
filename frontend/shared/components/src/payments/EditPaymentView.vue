<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox"/>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`b610d465-2901-4b54-97ae-dbeab72e4762`)">
                    <Dropdown v-model="type">
                        <option v-for="m in availableTypes" :key="m" :value="m">
                            {{ capitalizeFirstLetter(PaymentTypeHelper.getName(m)) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox :title="type === PaymentType.Payment ? $t(`d880e10c-63f5-4a84-a994-97bbfcb04f4f`) : $t(`c7db7d15-2dcd-4dfc-b7cd-34d6beef1bcf`)" error-fields="method" :error-box="errors.errorBox">
                    <Dropdown v-model="method">
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ PaymentMethodHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="!isNew" error-fields="status" :error-box="errors.errorBox" :title="$t(`38b75e19-10cb-4641-88a8-f4e2e9be7576`)">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ PaymentStatusHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <div>
                <STInputBox v-if="status === 'Succeeded'" :title="type === PaymentType.Payment ? $t(`e9a05ee4-cfd3-47bb-8f2e-0ad3731a417a`) : $t(`a88dacba-5ef8-489e-bd63-b8ecde75944d`)" error-fields="paidAt" :error-box="errors.errorBox">
                    <DateSelection v-model="paidAt"/>
                </STInputBox>
            </div>
        </div>

        <template v-if="method === PaymentMethod.Transfer">
            <hr><h2 v-if="type === PaymentType.Payment">
                {{ $t('4d474b6c-8224-416b-a1a3-72ccbaed8369') }}
            </h2>
            <h2 v-else>
                {{ $t('968bb234-03b6-46cb-8666-175b8fd07f51') }}
            </h2>

            <STInputBox :title="type === PaymentType.Payment ? $t(`f95defaa-5371-427d-9fa3-07be3e449a74`) : $t(`901a6bec-7c99-4c38-8873-866862040a12`)" error-fields="transferSettings.creditor" :error-box="errors.errorBox">
                <input v-model="creditor" class="input" type="text" autocomplete="off" :placeholder="$t(`03ffa196-1d54-4020-9563-7d647592d659`)"></STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="false" :title="$t(`42e471ed-1172-4deb-92a7-770f53dfd645`)" :placeholder="$t(`47650796-a3c4-43c7-b687-7898856d6644`)"/>

            <STInputBox error-fields="transferDescription" :error-box="errors.errorBox" :title="$t(`fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479`)">
                <input ref="firstInput" v-model="transferDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`acd39d2e-3080-42cb-a488-43e1895d1f91`)"></STInputBox>
        </template>

        <hr><h2>{{ $t('dfbe6605-b275-4d45-b6d9-4985a9c9ed37') }}</h2>
        <p v-if="patchedPayment.type === PaymentType.Payment">
            {{ $t('0c8b247a-9b71-467c-afdc-9943448127f3') }}
        </p>
        <p v-else-if="patchedPayment.type === PaymentType.Reallocation">
            {{ $t('d33a5c1b-850f-40bd-8c16-2d749a7410dd') }}
        </p>
        <p v-else>
            {{ $t('f24d4ba4-4b42-4fa1-b99f-4b90dd1a3208') }}
        </p>

        <SelectBalanceItemsList :items="balanceItems" :list="patchedPayment.balanceItemPayments" :is-payable="false" @patch="addPatch({balanceItemPayments: $event})"/>

        <STList v-if="createBalanceItem">
            <STListItem :selectable="true" element-name="button" @click="createBalanceItem">
                <template #left>
                    <IconContainer icon="box">
                        <template #aside>
                            <span class="icon add small primary"/>
                        </template>
                    </IconContainer>
                </template>
                <h3 class="style-title-list">
                    {{ $t('fa974919-91ab-4005-930c-5df57de4532f') }}
                </h3>

                <p class="style-description-small">
                    {{ $t('ffbb5f15-84cb-48be-98f4-cf392fd6f227') }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray"/>
                </template>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { I18nController, useTranslate } from '@stamhoofd/frontend-i18n';
import { BalanceItem, BalanceItemRelationType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, TransferSettings } from '@stamhoofd/structures';

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
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import SaveView from '../navigation/SaveView.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

const props = withDefaults(
    defineProps<{
        payment: PaymentGeneral;
        balanceItems: BalanceItem[];
        isNew?: boolean;
        saveHandler: ((patch: AutoEncoderPatchType<PaymentGeneral>) => Promise<void>);
        createBalanceItem?: null | (() => Promise<void>);
    }>(), {
        isNew: false,
        createBalanceItem: null,
    });

const { patched: patchedPayment, addPatch, hasChanges, patch } = usePatch(props.payment);
const organization = useOrganization();
const errors = useErrors();
const saving = ref(false);
const pop = usePop();
const $t = useTranslate();

const availableMethods = [
    PaymentMethod.Transfer,
    PaymentMethod.PointOfSale,
];

const availableTypes = [
    PaymentType.Payment,
    PaymentType.Refund,
];

const availableStatuses = [
    PaymentStatus.Pending,
    PaymentStatus.Succeeded,
    PaymentStatus.Failed,
];

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
            saving.value = false;
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
    return await CenteredMessage.confirm($t('996a4109-5524-4679-8d17-6968282a2a75'), $t('106b3169-6336-48b8-8544-4512d42c4fd6'));
};
defineExpose({
    shouldNavigateAway,
});
</script>
