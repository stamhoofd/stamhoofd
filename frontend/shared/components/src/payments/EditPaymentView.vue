<template>
    <SaveView :title="title" :disabled="!hasChanges && !isNew" class="edit-payment-view" :loading="saving" @save="save">
        <h1>
            {{ title }}
        </h1>

        <p v-if="price >= 0">
            Kies hieronder wat er precies betaald werd - en pas eventueel aan hoeveel. Dit is nodig om de boekhouding correct te houden en elke betaling te koppelen aan een specifieke items.
        </p>
        <p v-else>
            {{ $t('f24d4ba4-4b42-4fa1-b99f-4b90dd1a3208') }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <SelectBalanceItemsList :items="balanceItems" :list="patchedPayment.balanceItemPayments" :is-payable="false" @patch="addPatch({balanceItemPayments: $event})" />

        <STList v-if="createBalanceItem">
            <STListItem :selectable="true" element-name="button" @click="createBalanceItem">
                <template #left>
                    <IconContainer icon="label">
                        <template #aside>
                            <span class="icon add small primary" />
                        </template>
                    </IconContainer>
                </template>
                <h3 class="style-title-list">
                    Item toevoegen
                </h3>

                <p class="style-description-small">
                    Voeg een item toe aan het openstaand bedrag of geef een tegoed
                </p>

                <template #right>
                    <span class="icon arrow-right-small gray" />
                </template>
            </STListItem>
        </STList>

        <hr>
        <h2>Hoe?</h2>

        <div class="split-inputs">
            <div>
                <STInputBox title="Betaalmethode" error-fields="method" :error-box="errors.errorBox">
                    <Dropdown v-model="method">
                        <option v-for="m in availableMethods" :key="m" :value="m">
                            {{ PaymentMethodHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>

                <STInputBox title="Status" error-fields="status" :error-box="errors.errorBox">
                    <Dropdown v-model="status">
                        <option v-for="m in availableStatuses" :key="m" :value="m">
                            {{ PaymentStatusHelper.getNameCapitalized(m) }}
                        </option>
                    </Dropdown>
                </STInputBox>
            </div>
            <div>
                <STInputBox v-if="status === 'Succeeded'" :title="price >= 0 ? 'Ontvangen op' : 'Terugbetaald op'" error-fields="paidAt" :error-box="errors.errorBox">
                    <DateSelection v-model="paidAt" />
                </STInputBox>
            </div>
        </div>

        <p v-if="status !== 'Succeeded' && price >= 0" class="info-box">
            We raden aan enkel betalingen aan te maken die je hebt ontvangen. In het andere geval is het beter om de personen via de website te laten betalen - dan kunnen ze een betaalmethode kiezen (dat is ook veiliger tegen Phishing).
        </p>

        <p v-if="status !== 'Succeeded' && price < 0" class="info-box">
            We raden aan enkel terugbetalingen aan te maken die je al hebt terugbetaald.
        </p>

        <template v-if="method === 'Transfer'">
            <hr>
            <h2 v-if="price >= 0">
                Overschrijvingsdetails
            </h2>
            <h2 v-else>
                Rekening waarmee terugbetaald werd
            </h2>

            <STInputBox :title="price >= 0 ? 'Begunstigde' : 'Naam rekening'" error-fields="transferSettings.creditor" :error-box="errors.errorBox">
                <input
                    v-model="creditor"
                    class="input"
                    type="text"
                    placeholder="Naam bankrekeningnummer"
                    autocomplete=""
                >
            </STInputBox>

            <IBANInput v-model="iban" title="Bankrekeningnummer" placeholder="Op deze rekening schrijft men over" :validator="errors.validator" :required="false" />

            <STInputBox title="Mededeling" error-fields="transferDescription" :error-box="errors.errorBox">
                <input
                    ref="firstInput"
                    v-model="transferDescription"
                    class="input"
                    type="text"
                    placeholder="Bv. Aankoop x"
                    autocomplete=""
                >
            </STInputBox>
        </template>
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { I18nController, useTranslate } from '@stamhoofd/frontend-i18n';
import { BalanceItem, BalanceItemRelationType, PaymentGeneral, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, TransferSettings } from '@stamhoofd/structures';

import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import STErrorsDefault from '../errors/STErrorsDefault.vue';
import { useErrors } from '../errors/useErrors';
import { useOrganization, usePatch } from '../hooks';
import DateSelection from '../inputs/DateSelection.vue';
import Dropdown from '../inputs/Dropdown.vue';
import IBANInput from '../inputs/IBANInput.vue';
import STInputBox from '../inputs/STInputBox.vue';
import STList from '../layout/STList.vue';
import STListItem from '../layout/STListItem.vue';
import SaveView from '../navigation/SaveView.vue';
import { CenteredMessage } from '../overlays/CenteredMessage';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';
import IconContainer from '../icons/IconContainer.vue';

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

const availableStatuses = [
    PaymentStatus.Pending,
    PaymentStatus.Succeeded,
    PaymentStatus.Failed,
];

const title = computed(() => {
    return props.isNew ? (price.value >= 0 ? 'Betaling registreren' : 'Terugbetaling registreren') : 'Betaling bewerken';
});

const price = computed(() => patchedPayment.value.balanceItemPayments.reduce((total, item) => total + item.price, 0));

const method = computed({
    get: () => patchedPayment.value.method ?? PaymentMethod.Unknown,
    set: (method: PaymentMethod) => {
        if (method === patchedPayment.value.method) {
            return;
        }

        if (method === PaymentMethod.Transfer) {
            if (props.payment.transferDescription) {
                addPatch({
                    method,
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
                    method,
                    transferDescription: transferSettings.generateDescription('', I18nController.shared.country),
                    transferSettings: transferSettings,
                });
            }
        }
        else {
            addPatch({
                method,
                transferDescription: null,
                transferSettings: null,
            });
        }
    },
});

const status = computed({
    get: () => patchedPayment.value.status,
    set: (status: PaymentStatus) => {
        addPatch({
            status,
            paidAt: status === PaymentStatus.Succeeded ? (props.payment.paidAt ?? new Date()) : null,
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
