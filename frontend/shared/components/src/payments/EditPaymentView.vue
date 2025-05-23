<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="type" :error-box="errors.errorBox" :title="$t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`)">
                    <Dropdown v-model="type">
                        <option v-for="m in availableTypes" :key="m" :value="m">
                            {{ capitalizeFirstLetter(PaymentTypeHelper.getName(m)) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox :title="type === PaymentType.Payment ? $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`) : $t(`1d8b2fd0-3e5c-4364-9476-b7b40ca39c50`)" error-fields="method" :error-box="errors.errorBox">
                    <Dropdown v-model="method">
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ PaymentMethodHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox v-if="!isNew" error-fields="status" :error-box="errors.errorBox" :title="$t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`)">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ PaymentStatusHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <div>
                <STInputBox v-if="status === 'Succeeded'" :title="type === PaymentType.Payment ? $t(`57634df7-7db8-4c1d-8351-878c649b5078`) : $t(`7cea4ccc-16d1-42ae-87af-34a603013577`)" error-fields="paidAt" :error-box="errors.errorBox">
                    <DateSelection v-model="paidAt" />
                </STInputBox>
            </div>
        </div>

        <template v-if="method === PaymentMethod.Transfer">
            <hr><h2 v-if="type === PaymentType.Payment">
                {{ $t('1a34199f-e779-4947-b0d3-a41aeefa901a') }}
            </h2>
            <h2 v-else>
                {{ $t('12472cd2-4c67-4e54-81dc-cba8fd6c1c91') }}
            </h2>

            <STInputBox :title="type === PaymentType.Payment ? $t(`31c28f13-d3b8-42ee-8979-c8224633237e`) : $t(`edfb74fb-9e81-4fbf-9591-cd9780ee977d`)" error-fields="transferSettings.creditor" :error-box="errors.errorBox">
                <input v-model="creditor" class="input" type="text" autocomplete="off" :placeholder="$t(`e57ce79c-d0f6-4d7e-a8f4-2efbf12c1433`)">
            </STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="false" :title="$t(`b541ddfb-cce5-4194-b6a5-3de523b27fa8`)" :placeholder="$t(`95854f9f-45df-4775-9d37-524efbbbc57f`)" />

            <STInputBox error-fields="transferDescription" :error-box="errors.errorBox" :title="$t(`136b7ba4-7611-4ee4-a46d-60758869210f`)">
                <input ref="firstInput" v-model="transferDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`dc7631e2-c6ed-4508-ada0-40eebc5fc24e`)">
            </STInputBox>
        </template>

        <hr><h2>{{ $t('e8ea4460-67bb-42a3-b688-cc22987fe8af') }}</h2>
        <p v-if="patchedPayment.type === PaymentType.Payment">
            {{ $t('ab973473-d8d9-4126-ad71-fa26a8aa53e4') }}
        </p>
        <p v-else-if="patchedPayment.type === PaymentType.Reallocation">
            {{ $t('960cd3db-0af9-4761-906c-306598381950') }}
        </p>
        <p v-else>
            {{ $t('f24d4ba4-4b42-4fa1-b99f-4b90dd1a3208') }}
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
                    {{ $t('f2babc21-ce3a-4000-acb5-c1623b7b9e43') }}
                </h3>

                <p class="style-description-small">
                    {{ $t('b79653ad-3b9b-4586-bd26-cbca7ccb2ecf') }}
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
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
