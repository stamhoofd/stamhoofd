<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :save-text="$t('%6m')" save-icon="calculator" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            <span v-if="selectionCount === null" class="style-placeholder-skeleton" />
            <span v-else>{{ chargeViewDescription }}</span>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div class="split-inputs">
            <STInputBox v-if="app === 'admin'" :title="$t('%6n')" error-fields="organization" :error-box="errors.errorBox">
                <OrganizationSelect v-model="selectedOrganization" />
            </STInputBox>

            <STInputBox :title="$t('%1Os')" error-fields="name" :error-box="errors.errorBox">
                <input v-model="name" class="input" type="text" :placeholder="$t('%ZqX')" autocomplete="off">
            </STInputBox>
        </div>

        <STInputBox error-fields="description" :error-box="errors.errorBox" :title="$t('%6o')" class="max">
            <textarea v-model="description" class="input" :placeholder="$t('%14p')" />
        </STInputBox>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="price" :error-box="errors.errorBox" :title="$t('%6q')">
                    <PriceInput v-model="price" :min="null" :placeholder="formatPrice(0)" />

                    <template #right>
                        <VATIncludedToggle v-model="VATIncluded" :invoices-enabled="invoicesEnabled" />
                    </template>
                </STInputBox>
            </div>
            <NumberInputBox v-model="amount" :title="$t('%M4')" error-fields="amount" :error-box="errors.errorBox" :validator="errors.validator" :min="1" :stepper="true" />
        </div>

        <div class="split-inputs">
            <div>
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`%gq`)">
                    <DateSelection v-model="createdAt" />
                </STInputBox>
            </div>
            <div v-if="price >= 0">
                <STInputBox :title="$t('%Cj')" error-fields="dueAt" :error-box="errors.errorBox">
                    <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`%gr`)" />
                </STInputBox>
            </div>
        </div>

        <VATPercentageInput v-model:percentage="VATPercentage" v-model:excempt="VATExcempt" :invoices-enabled="invoicesEnabled" :error-box="errors.errorBox" />

        <PriceBreakdownBox :price-breakdown="balanceItem.priceBreakown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { useAppContext } from '#context/appContext.ts';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { useValidation } from '#errors/useValidation.ts';
import { useExternalOrganization } from '#groups/hooks/useExternalOrganization.ts';
import { useContext } from '#hooks/useContext.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import DateSelection from '#inputs/DateSelection.vue';
import PriceInput from '#inputs/PriceInput.vue';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { Toast } from '#overlays/Toast.ts';
import VATIncludedToggle from '#payments/components/VATIncludedToggle.vue';
import VATPercentageInput from '#payments/components/VATPercentageInput.vue';
import PriceBreakdownBox from '#views/PriceBreakdownBox.vue';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import type { Organization, StamhoofdFilter, VATExcemptReason } from '@stamhoofd/structures';
import { BalanceItem, ChargeRequest } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';
import NumberInputBox from '../inputs/NumberInputBox.vue';
import OrganizationSelect from '../organizations/components/OrganizationSelect.vue';
import { useChargeCount } from './hooks/useChargeCount';

const props = withDefaults(defineProps<{
    filter: StamhoofdFilter;
    countEndpointPath: string;
    chargeEndpointPath: string;
    getDescription: (args: { count: number }) => string;
    getConfirmationText: (args: { total: string; count: number | null }) => string;
}>(), {
});

const errors = useErrors();

const pop = usePop();
const owner = useRequestOwner();
const context = useContext();
const platform = usePlatform();
const { count } = useChargeCount(props.countEndpointPath);
const app = useAppContext();

count(props.filter)
    .then((result: number | null) => {
        if (result !== null) {
            selectionCount.value = result;
        }
    })
    .catch(console.error);

const selectionCount = ref<number | null>(null);
const organization = useOrganization();
const selectedOrganization = ref<Organization | null>(organization.value) as Ref<Organization | null>;
const name = ref('');
const description = ref('');
const price = ref(0);
const amount = ref(1);
const VATPercentage = ref<number | null>(null);
const VATIncluded = ref(true);
const VATExcempt = ref<VATExcemptReason | null>(null);
const invoicesEnabled = computed(() => selectedOrganization.value?.meta.invoicesEnabled ?? false);
const hasChanges = computed(() => name.value !== '' || description.value !== '' || price.value !== 0);

const createdAt = ref(new Date());
const dueAt = ref(null);

const balanceItem = computed(() => BalanceItem.create({
    unitPrice: price.value,
    amount: amount.value,
    VATPercentage: VATPercentage.value,
    VATIncluded: VATIncluded.value,
    VATExcempt: VATExcempt.value,
}));
const total = computed(() => balanceItem.value.priceWithVAT);

const chargeViewDescription = computed(() => {
    if (selectionCount.value === null) {
        return '';
    }

    return props.getDescription({ count: selectionCount.value });
});

const saving = ref(false);

const title = $t('%Gu');

const defaultOrganizationId = computed(() => organization.value === null ? platform.value.membershipOrganizationId : null);
const { externalOrganization: defaultOrganization } = useExternalOrganization(defaultOrganizationId);

watch(defaultOrganization, (organization) => {
    if (organization !== null && selectedOrganization.value === null) {
        selectedOrganization.value = organization;
    }
}, { immediate: true });

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

    if (selectedOrganization.value === null) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%12V`),
            field: 'organization',
        }));
    }

    if (name.value.trim().length === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%Cr`),
            field: 'name',
        }));
    }

    if (price.value === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`%Cs`),
            field: 'price',
        }));
    }

    if (se.errors.length > 0) {
        errors.errorBox = new ErrorBox(se);
        return false;
    }

    errors.errorBox = null;
    return true;
});

async function save() {
    if (saving.value || !hasChanges.value) {
        return;
    }
    saving.value = true;

    const isValid = await errors.validator.validate();
    if (!isValid) {
        saving.value = false;
        return;
    }

    const isConfirm = await CenteredMessage.confirm(props.getConfirmationText({ total: Formatter.price(total.value), count: selectionCount.value }),
        $t('%6m'),
    );

    if (!isConfirm) {
        saving.value = false;
        return;
    }

    try {
        const body = ChargeRequest.create({
            price: price.value,
            name: name.value,
            description: description.value.trim() || null,
            amount: amount.value,
            VATPercentage: VATPercentage.value,
            VATIncluded: VATIncluded.value,
            VATExcempt: VATExcempt.value,
            dueAt: dueAt.value,
            createdAt: createdAt.value,
            filter: props.filter,
        });

        await (selectedOrganization.value ? context.value.getAuthenticatedServerForOrganization(selectedOrganization.value.id) : context.value.authenticatedServer).request({
            method: 'POST',
            path: props.chargeEndpointPath,
            shouldRetry: false,
            body,
            owner,
        });

        new Toast($t(`%12W`), 'success green').show();

        await pop({ force: true });
    }
    catch (error: any) {
        errors.errorBox = new ErrorBox(error);
    }

    saving.value = false;
}

const shouldNavigateAway = async () => {
    if (!hasChanges.value) {
        return true;
    }
    return await CenteredMessage.confirm($t('%6r'), $t('%6s'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
