<template>
    <SaveView :loading="saving" :title="title" :disabled="false" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="paymentMethod === PaymentMethod.Transfer">
            <STInputBox error-fields="transferSettings.creditor" :error-box="errors.errorBox" :title="$t(`31c28f13-d3b8-42ee-8979-c8224633237e`)">
                <input v-model="creditor" class="input" type="text" :placeholder="organization.name" autocomplete="off">
            </STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="true" :title="$t(`b541ddfb-cce5-4194-b6a5-3de523b27fa8`)" />

            <STInputBox error-fields="transferSettings.type" :error-box="errors.errorBox" class="max" :title="$t(`aac4ace7-828f-4148-88f1-d49b50610cdd`)">
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
                <span>{{ $t('669bef94-f6a1-4a84-8f2c-5de06ea05db3') }} <span v-if="type === 'webshop'">{{ $t('6c2068f6-73c6-4e88-b104-15f95832838f') }}</span><span v-else>{{ $t('39c566d6-520d-4048-bb1a-53eeea3ccea7') }}</span> {{ $t('72e5e374-ecd9-40e5-ae80-d14553faab50') }} <em class="style-em">{{ $t('789da13b-5f65-4ab7-8318-ed015e0303cf') }}</em> {{ $t("cc322a9c-e781-4a4e-9e45-fb1355d3c536") }}</span>
            </p>

            <STInputBox v-if="transferType !== 'Structured'" :title="transferType === 'Fixed' ? $t(`136b7ba4-7611-4ee4-a46d-60758869210f`) : $t(`da96b2e0-1caa-4cf8-8276-94d907c64057`)" error-fields="transferSettings.prefix" :error-box="errors.errorBox">
                <input v-model="prefix" class="input" type="text" :placeholder="transferType === 'Fixed' ? $t(`136b7ba4-7611-4ee4-a46d-60758869210f`) : (type === 'registration' ? $t(`ff789452-b123-437a-a77b-34f3e0dd3e5c`) : $t(`082234bc-835d-4c27-9fb4-5ab2221719a9`))" autocomplete="off">
            </STInputBox>

            <p v-if="transferExample && transferExample !== prefix" class="style-description-small">
                {{ $t('ac28d270-81d6-4393-ae2c-6b0da9828cb2') }} <span class="style-em">{{ transferExample }}</span>
            </p>

            <p v-if="transferType === 'Fixed' && type === 'webshop'" class="style-description-small">
                {{ $t('152f1003-ba4e-4ae0-acef-475bef27e4a5') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('940c3987-3048-441e-9933-3fa51c6d421d') + '}}'" />, <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('340f1829-3bb9-419d-8646-ba3b34eea958') + '}}'" /> {{ $t('411cf334-eebb-4f27-beb6-d81bd544c3f5') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('fb17210e-534f-48f3-b6a2-756428d117ee') + '}}'" />
            </p>
            <p v-else-if="transferType === 'Fixed' && type === 'registration'" class="style-description-small">
                {{ $t('152f1003-ba4e-4ae0-acef-475bef27e4a5') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('940c3987-3048-441e-9933-3fa51c6d421d') + '}}'" />
            </p>

            <hr><h2>{{ $t('717310b7-527a-4870-99c4-b6b3a42fe3fa') }}</h2>
            <p>{{ $t('b7adfe7d-d1c9-482c-bba2-ecaffd9aa0b3') }}</p>

            <STInputBox title="" error-fields="infoDescription" :error-box="errors.errorBox" class="max">
                <textarea v-model="infoDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`0e392740-3dd9-4454-b33f-320465f1a52c`)" />
            </STInputBox>

            <hr><h2>{{ $t('6a11d3a7-6348-4aca-893e-0f026e5eb8b0') }}</h2>
        </template>

        <STList>
            <STListItem v-if="companiesOnly || auth.hasPlatformFullAccess()" key="companiesOnly" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="companiesOnly" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('404635de-cba2-4a9d-91dc-3309755c070f') }}
                </h3>
            </STListItem>

            <STListItem key="useMinimumAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMinimumAmount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('6576e1fc-a49f-487f-ad2d-fc4bfb7b2550') }}
                </h3>

                <div v-if="useMinimumAmount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="minimumAmount" :error-box="errors.errorBox" :title="$t(`ecfdb06e-e649-47d7-8047-4e340e6f6988`)">
                        <PriceInput v-model="minimumAmount" :min="2" :validator="errors.validator" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem key="useWarning" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarning" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('7410de9e-6805-41e5-b166-9e590056c41b') }}
                </h3>

                <div v-if="useWarning" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="warningText" :error-box="errors.errorBox" class="max">
                        <textarea v-model="warningText" class="input" type="text" autocomplete="off" :placeholder="$t(`73dbf494-16a3-4e9a-8cbe-5170334209c0`)" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="useWarning" key="useWarningAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarningAmount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('62f644a2-98ba-4a8d-b7fd-22b2d0bb4d45') }}
                </h3>

                <div v-if="useWarningAmount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="warningAmount" :error-box="errors.errorBox">
                        <PriceInput v-model="warningAmount" class="input" type="text" :min="1" :validator="errors.validator" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>
    </SaveView>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, IBANInput, PriceInput, Toast, useAuth, useErrors, usePatch, useRequiredOrganization } from '@stamhoofd/components';
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
            description: $t(`140fd2a3-d019-45a9-9d2b-754111da04f6`),
        },
        {
            value: TransferDescriptionType.Reference,
            name: props.type === 'registration' ? $t(`1add2f6b-1c51-49f9-9fe3-a9a1ad62ad07`) : $t(`4d496edf-0203-4df3-a6e9-3e58d226d6c5`),
            description: $t(`6d5b370e-491e-4565-acc9-444fe7e230fe`),
        },
        {
            value: TransferDescriptionType.Fixed,
            name: $t(`610a54d0-5ae5-4e4c-bac3-205fd56b65c8`),
            description: props.type === 'registration'
                ? $t(`35112ce1-48f4-4078-918a-0dc66f25cff0`)
                : $t(`1d8e0c76-eca0-4973-98bc-ebf7f940f05e`),

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
