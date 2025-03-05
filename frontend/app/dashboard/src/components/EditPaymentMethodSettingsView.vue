<template>
    <SaveView :loading="saving" :title="title" :disabled="false" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox"/>

        <template v-if="paymentMethod === PaymentMethod.Transfer">
            <STInputBox error-fields="transferSettings.creditor" :error-box="errors.errorBox" :title="$t(`f95defaa-5371-427d-9fa3-07be3e449a74`)">
                <input v-model="creditor" class="input" type="text" :placeholder="organization.name" autocomplete="off"></STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="true" :title="$t(`42e471ed-1172-4deb-92a7-770f53dfd645`)"/>

            <STInputBox error-fields="transferSettings.type" :error-box="errors.errorBox" class="max" :title="$t(`4cb06958-0fda-4abe-98ed-dec2d9c57763`)">
                <STList>
                    <STListItem v-for="_type in transferTypes" :key="_type.value" :selectable="true" element-name="label">
                        <template #left>
                            <Radio v-model="transferType" :value="_type.value"/>
                        </template>
                        <h3 class="style-title-list">
                            {{ _type.name }}
                        </h3>
                        <p v-if="transferType === _type.value" class="style-description pre-wrap" v-text="_type.description"/>
                    </STListItem>
                </STList>
            </STInputBox>

            <p v-if="transferType !== 'Structured'" class="warning-box">
                <span>{{ $t('b7fc4adc-05d8-4772-a5ef-d9a266316c06') }} <span v-if="type === 'webshop'">{{ $t('bf84dd6d-82fd-4ae7-bb77-d2c3cbabd208') }}</span><span v-else>{{ $t('37abef6b-2123-433a-9ed1-2b430d9bf360') }}</span> {{ $t('48770c62-d873-4a83-add5-80fcaa484f66') }} <em class="style-em">{{ $t('d2d77824-f603-4bc5-ae5e-584bcd6597c7') }}</em> {{ $t("0c6ce5bb-ac90-4cc8-b888-f92cdad9d482") }}</span>
            </p>

            <STInputBox v-if="transferType !== 'Structured'" :title="transferType === 'Fixed' ? $t(`fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479`) : $t(`4d70b3f4-edc2-42c6-a855-7e1db2a69f99`)" error-fields="transferSettings.prefix" :error-box="errors.errorBox">
                <input v-model="prefix" class="input" type="text" :placeholder="transferType === 'Fixed' ? $t(`fb7e4e6a-c7a6-4e1a-84ce-87bcf622f479`) : (type === 'registration' ? $t(`81f5f0fd-f73a-47fb-a50d-27a429bfee56`) : $t(`a93976c7-c035-4175-aad6-cbc5d82e4b2a`))" autocomplete="off"></STInputBox>

            <p v-if="transferExample && transferExample !== prefix" class="style-description-small">
                {{ $t('79dd3f16-544e-4992-ae89-897aab7cf1d5') }} <span class="style-em">{{ transferExample }}</span>
            </p>

            <p v-if="transferType === 'Fixed' && type === 'webshop'" class="style-description-small">
                {{ $t('8f872ab5-7565-4177-8784-b17f1f24359c') }} <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`"/>, <code v-copyable class="style-inline-code style-copyable" v-text="`{{email}}`"/> {{ $t('c8077f4f-684f-4669-8105-af63bde16322') }} <code v-copyable class="style-inline-code style-copyable" v-text="`{{nr}}`"/>
            </p>
            <p v-else-if="transferType === 'Fixed' && type === 'registration'" class="style-description-small">
                {{ $t('8f872ab5-7565-4177-8784-b17f1f24359c') }} <code v-copyable class="style-inline-code style-copyable" v-text="`{{naam}}`"/>
            </p>

            <hr><h2>{{ $t('93ee0ba6-f06e-48f7-bfd0-0a1e4ae54fee') }}</h2>
            <p>{{ $t('bcfc8d29-6bb2-4abe-bcb6-f56645dd45f5') }}</p>

            <STInputBox title="" error-fields="infoDescription" :error-box="errors.errorBox" class="max">
                <textarea v-model="infoDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`cf202718-08dc-44f8-88a6-eeba992864ab`)"/>
            </STInputBox>

            <hr><h2>{{ $t('2dfdb75f-fd62-45df-bc9f-a34a5570dd32') }}</h2>
        </template>

        <STList>
            <STListItem v-if="companiesOnly || auth.hasPlatformFullAccess()" key="companiesOnly" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="companiesOnly"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('09bfdf4d-479d-4a47-b510-7a870447171c') }}
                </h3>
            </STListItem>

            <STListItem key="useMinimumAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMinimumAmount"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('03c0d712-cfa3-4fd5-b2af-7a3a1b22bc0a') }}
                </h3>

                <div v-if="useMinimumAmount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="minimumAmount" :error-box="errors.errorBox" :title="$t(`bea59ed7-0865-44ae-9e8f-7428ffb9c35f`)">
                        <PriceInput v-model="minimumAmount" :min="2" :validator="errors.validator"/>
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem key="useWarning" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarning"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('5cf7e71c-76ac-4169-aa84-08fef30f753e') }}
                </h3>

                <div v-if="useWarning" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="warningText" :error-box="errors.errorBox" class="max">
                        <textarea v-model="warningText" class="input" type="text" autocomplete="off" :placeholder="$t(`ec2d213d-35b7-4938-bd72-a05f8a4569b0`)"/>
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="useWarning" key="useWarningAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarningAmount"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('4dbafe0a-e04a-438a-b46a-22c519aca406') }}
                </h3>

                <div v-if="useWarningAmount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="warningAmount" :error-box="errors.errorBox">
                        <PriceInput v-model="warningAmount" class="input" type="text" :min="1" :validator="errors.validator"/>
                    </STInputBox>
                </div>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, PriceInput, Toast, useErrors, usePatch, useRequiredOrganization, IBANInput, NumberInput, useAuth } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { PaymentConfiguration, PaymentMethod, PaymentMethodHelper, PaymentMethodSettings, TransferDescriptionType, TransferSettings } from '@stamhoofd/structures';
import { computed, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        type: 'registration' | 'webshop';
        paymentMethod: PaymentMethod;
        configuration: PaymentConfiguration;
        saveHandler: (configuration: AutoEncoderPatchType<PaymentConfiguration>) => Promise<void>;
    }>(),
    {},
);

const { patched, hasChanges, addPatch, patch } = usePatch(props.configuration);
const errors = useErrors();
const saving = ref(false);
const $t = useTranslate();
const pop = usePop();
const organization = useRequiredOrganization();
const auth = useAuth();

const title = computed(() => {
    return PaymentMethodHelper.getPluralNameCapitalized(props.paymentMethod);
});

const settings = computed(() => patched.value.paymentMethodSettings.get(props.paymentMethod) ?? PaymentMethodSettings.create({}));

function addPatchSettings(patch: PartialWithoutMethods<AutoEncoderPatchType<PaymentMethodSettings>>) {
    const p = PaymentConfiguration.patch({});

    if (!patched.value.paymentMethodSettings.get(props.paymentMethod)) {
        p.paymentMethodSettings.set(props.paymentMethod, settings.value.patch(patch));
    }
    else {
        p.paymentMethodSettings.set(props.paymentMethod, PaymentMethodSettings.patch(patch));
    }
    addPatch(p);
}

const minimumAmount = computed({
    get: () => settings.value.minimumAmount,
    set: minimumAmount => addPatchSettings({ minimumAmount }),
});

const useMinimumAmount = computed({
    get: () => settings.value.minimumAmount !== 0,
    set: (useMinimumAmount) => {
        if (useMinimumAmount) {
            minimumAmount.value = 100000;
        }
        else {
            minimumAmount.value = 0;
        }
    },
});

const companiesOnly = computed({
    get: () => settings.value.companiesOnly,
    set: companiesOnly => addPatchSettings({ companiesOnly }),
});

const warningText = computed({
    get: () => settings.value.warningText,
    set: warningText => addPatchSettings({ warningText }),
});

const warningAmount = computed({
    get: () => settings.value.warningAmount,
    set: warningAmount => addPatchSettings({ warningAmount }),
});

const cachedUseWarning = ref(false);

const useWarning = computed({
    get: () => !!settings.value.warningText || cachedUseWarning.value,
    set: (useWarning) => {
        cachedUseWarning.value = useWarning;
        if (!useWarning) {
            warningText.value = '';
        }
    },
});

const useWarningAmount = computed({
    get: () => settings.value.warningAmount !== null,
    set: (useWarningAmount) => {
        if (useWarningAmount === (warningAmount.value !== null)) {
            return;
        }

        if (useWarningAmount) {
            warningAmount.value = 10000;
        }
        else {
            warningAmount.value = null;
        }
    },
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
        return patched.value.transferSettings.type;
    },
    set: (value: TransferDescriptionType) => {
        addPatch(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                type: value,
            }),
        }));
    },
});

const creditor = computed({
    get: () => {
        return patched.value.transferSettings.creditor;
    },
    set: (creditor: string | null) => {
        addPatch(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                creditor: !creditor || creditor.length === 0 || creditor === organization.value.name ? null : creditor,
            }),
        }));
    },
});

const iban = computed({
    get: () => {
        return patched.value.transferSettings.iban;
    },
    set: (iban: string | null) => {
        addPatch(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                iban: !iban || iban.length === 0 ? null : iban,
            }),
        }));
    },
});

const prefix = computed({
    get: () => {
        return patched.value.transferSettings.prefix;
    },
    set: (prefix: string | null) => {
        addPatch(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                prefix,
            }),
        }));
    },
});

const infoDescription = computed({
    get: () => {
        return patched.value.transferSettings.infoDescription;
    },
    set: (infoDescription) => {
        addPatch(PaymentConfiguration.patch({
            transferSettings: TransferSettings.patch({
                infoDescription,
            }),
        }));
    },
});

const transferExample = computed(() => {
    const fakeReference = props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : '152';
    const settings = patched.value.transferSettings;

    return settings.generateDescription(fakeReference, organization.value.address.country, {
        nr: props.type === 'registration' ? '' : fakeReference,
        email: props.type === 'registration' ? '' : $t('245e4d9b-3b80-42f5-8503-89a480995f0e').toString(),
        phone: props.type === 'registration' ? '' : $t('0c3689c1-01f8-455a-a9b0-8f766c03b2d3').toString(),
        name: props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : $t('bb910a6c-ec64-46d8-bebb-c3b4312bbfb4').toString(),
        naam: props.type === 'registration' ? $t('274d0a26-49b8-4dfa-a8bf-21368b12dca7').toString() : $t('bb910a6c-ec64-46d8-bebb-c3b4312bbfb4').toString(),
    });
});

async function save() {
    if (saving.value) {
        return;
    }

    saving.value = true;

    if (!await errors.validator.validate()) {
        saving.value = false;
        return;
    }

    try {
        await props.saveHandler(patch.value);
        await pop({ force: true });
    }
    catch (e) {
        Toast.fromError(e).show();
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
