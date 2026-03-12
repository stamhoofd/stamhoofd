<template>
    <SaveView :loading="saving" :title="title" :disabled="false" @save="save">
        <h1>
            {{ title }}
        </h1>
        <STErrorsDefault :error-box="errors.errorBox" />

        <template v-if="paymentMethod === PaymentMethod.Transfer">
            <STInputBox error-fields="transferSettings.creditor" :error-box="errors.errorBox" :title="$t(`%J5`)">
                <input v-model="creditor" class="input" type="text" :placeholder="organization.name" autocomplete="off">
            </STInputBox>

            <IBANInput v-model="iban" :validator="errors.validator" :required="true" :title="$t(`%J6`)" />

            <STInputBox error-fields="transferSettings.type" :error-box="errors.errorBox" class="max" :title="$t(`%J7`)">
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
                <span>{{ $t('%Ir') }} <span v-if="type === 'webshop'">{{ $t('%Is') }}</span><span v-else>{{ $t('%It') }}</span> {{ $t('%Iu') }} <em class="style-em">{{ $t('%Iv') }}</em> {{ $t("%J4") }}</span>
            </p>

            <STInputBox v-if="transferType !== 'Structured'" :title="transferType === 'Fixed' ? $t(`%J8`) : $t(`%J9`)" error-fields="transferSettings.prefix" :error-box="errors.errorBox">
                <input v-model="prefix" class="input" type="text" :placeholder="transferType === 'Fixed' ? $t(`%J8`) : (type === 'registration' ? $t(`%JA`) : $t(`%JB`))" autocomplete="off">
            </STInputBox>

            <p v-if="transferExample && transferExample !== prefix" class="style-description-small">
                {{ $t('%Iw') }} <span class="style-em">{{ transferExample }}</span>
            </p>

            <p v-if="transferType === 'Fixed' && type === 'webshop'" class="style-description-small">
                {{ $t('%Ix') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('%14R') + '}}'" />, <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('%k') + '}}'" /> {{ $t('%GT') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('%14S') + '}}'" />
            </p>
            <p v-else-if="transferType === 'Fixed' && type === 'registration'" class="style-description-small">
                {{ $t('%Ix') }} <code v-copyable class="style-inline-code style-copyable" v-text="'{{' + $t('%14R') + '}}'" />
            </p>

            <hr><h2>{{ $t('%Iy') }}</h2>
            <p>{{ $t('%Iz') }}</p>

            <STInputBox title="" error-fields="infoDescription" :error-box="errors.errorBox" class="max">
                <textarea v-model="infoDescription" class="input" type="text" autocomplete="off" :placeholder="$t(`%JC`)" />
            </STInputBox>

            <hr><h2>{{ $t('%HQ') }}</h2>
        </template>

        <STList>
            <STListItem v-if="companiesOnly || auth.hasPlatformFullAccess()" key="companiesOnly" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="companiesOnly" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%J0') }}
                </h3>
            </STListItem>

            <STListItem key="useMinimumAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useMinimumAmount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%J1') }}
                </h3>

                <div v-if="useMinimumAmount" class="split-inputs option" @click.stop.prevent>
                    <STInputBox error-fields="minimumAmount" :error-box="errors.errorBox" :title="$t(`%JD`)">
                        <PriceInput v-model="minimumAmount" :min="2" :validator="errors.validator" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem key="useWarning" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarning" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%J2') }}
                </h3>

                <div v-if="useWarning" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="warningText" :error-box="errors.errorBox" class="max">
                        <textarea v-model="warningText" class="input" type="text" autocomplete="off" :placeholder="$t(`%JE`)" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="useWarning" key="useWarningAmount" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useWarningAmount" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%J3') }}
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
import { CenteredMessage } from '@stamhoofd/components/overlays/CenteredMessage.ts';
import IBANInput from '@stamhoofd/components/inputs/IBANInput.vue';
import PriceInput from '@stamhoofd/components/inputs/PriceInput.vue';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import { useAuth } from '@stamhoofd/components/hooks/useAuth.ts';
import { useErrors } from '@stamhoofd/components/errors/useErrors.ts';
import { usePatch } from '@stamhoofd/components/hooks/usePatch.ts';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization.ts';
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
            name: $t('%2z'),
            description: $t(`%JF`),
        },
        {
            value: TransferDescriptionType.Reference,
            name: props.type === 'registration' ? $t(`%JG`) : $t(`%xA`),
            description: $t(`%JH`),
        },
        {
            value: TransferDescriptionType.Fixed,
            name: $t(`%JI`),
            description: props.type === 'registration'
                ? $t(`%JJ`)
                : $t(`%JK`),

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
    const fakeReference = props.type === 'registration' ? $t('%59').toString() : '152';
    const settings = patched.value.transferSettings;

    return settings.generateDescription(fakeReference, organization.value.address.country, {
        nr: props.type === 'registration' ? '' : fakeReference,
        email: props.type === 'registration' ? '' : $t('%57').toString(),
        phone: props.type === 'registration' ? '' : $t('%R').toString(),
        name: props.type === 'registration' ? $t('%59').toString() : $t('%58').toString(),
        naam: props.type === 'registration' ? $t('%59').toString() : $t('%58').toString(),
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
    return await CenteredMessage.confirm($t('%A0'), $t('%4X'));
};

defineExpose({
    shouldNavigateAway,
});

</script>
