<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :save-text="$t('00bdd5bd-af3f-4f83-abe0-696d5b872ca9')" save-icon="calculator" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            <span v-if="selectionCount === null" class="style-placeholder-skeleton" />
            <span v-else>{{ chargeViewDescription }}</span>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <div :class="{'split-inputs': modalDisplayStyle === 'popup' && showSelectOrganization}">
            <STInputBox v-if="showSelectOrganization" :title="$t('4a5ca65c-3a96-4ca0-991c-518a9e92adb7')" error-fields="organization" :error-box="errors.errorBox">
                <OrganizationSelect v-model="selectedOrganization" />
            </STInputBox>

            <STInputBox :title="$t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c')" error-fields="description" :error-box="errors.errorBox">
                <input v-model="description" class="input" type="text" :placeholder="$t('e4a32f97-64aa-43d7-803f-3d18f7cdf8e4')" autocomplete="given-name">
            </STInputBox>
        </div>

        <div class="split-inputs">
            <STInputBox :title="$t('7453643b-fdb2-4aa1-9964-ddd71762c983')" error-fields="price" :error-box="errors.errorBox">
                <PriceInput v-model="price" :placeholder="formatPrice(0)" :required="true" :min="null" />
            </STInputBox>
            <STInputBox :title="$t('a0f52fae-a4e6-4c3c-a6af-83218dd399b2')" error-fields="amount" :error-box="errors.errorBox">
                <NumberInput v-model="amount" :title="$t('a0f52fae-a4e6-4c3c-a6af-83218dd399b2')" :validator="errors.validator" :min="1" />
            </STInputBox>
        </div>

        <div class="split-inputs">
            <div v-if="showCreatedAt">
                <STInputBox error-fields="createdAt" :error-box="errors.errorBox" :title="$t(`ab0535e6-bbaa-4961-a34f-aca39ef0d785`)">
                    <DateSelection v-model="createdAt" />
                </STInputBox>
            </div>
            <div v-if="canShowDueAt">
                <STInputBox :title="$t('1402e826-1f61-498a-81b4-595dce3248d0') + (dueAtDescription ? '*' : '')" error-fields="dueAt" :error-box="errors.errorBox">
                    <DateSelection v-model="dueAt" :required="false" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t(`ef2b5d01-756d-46d0-8e1d-a200f43a3921`)" />
                </STInputBox>
            </div>
        </div>

        <p v-if="canShowDueAt && dueAtDescription" class="style-description-small">
            {{ dueAtDescription }}
        </p>

        <PriceBreakdownBox :price-breakdown="priceBreakdown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { AutoEncoder } from '@simonbackx/simple-encoding';
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, DateSelection, ErrorBox, NumberInput, PriceBreakdownBox, PriceInput, Toast, useContext, useErrors, useExternalOrganization, usePlatform, useValidation } from '@stamhoofd/components';
import { useRequestOwner } from '@stamhoofd/networking';
import { LimitedFilteredRequest, Organization, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref, watch } from 'vue';
import { useCount } from '../composables/useCount';
import OrganizationSelect from '../organizations/components/OrganizationSelect.vue';

export type ChargeViewOptions = {
    filter: StamhoofdFilter;
    countEndpointPath: string; chargeEndpointPath: string;
    getDescription: (args: { count: number }) => string;
    getConfirmationText: (args: { total: string; count: number | null }) => string;
    dueAtDescription?: string;
    createBody: (args: { organizationId: string;
        price: number;
        description: string;
        amount: number | null;
        dueAt: Date | null;
        createdAt: Date | null; }) => AutoEncoder;
    modalDisplayStyle?: 'sheet' | 'popup';
    showCreatedAt?: boolean;
    showDueAt?: boolean;
    organization?: Organization | null;
};

const props = withDefaults(defineProps<ChargeViewOptions>(), {
    showCreatedAt: false,
    showDueAt: false,
    modalDisplayStyle: 'sheet',
    organization: null,
    dueAtDescription: undefined,
});

const errors = useErrors();

const pop = usePop();
const owner = useRequestOwner();
const context = useContext();
const platform = usePlatform();
const { count } = useCount(props.countEndpointPath);

count(props.filter)
    .then((result: number | null) => {
        if (result !== null) {
            selectionCount.value = result;
        }
    })
    .catch(console.error);

const selectionCount = ref<number | null>(null);
const selectedOrganization = ref<Organization | null>(props.organization) as Ref<Organization | null>;
const showSelectOrganization = computed(() => props.organization === null);
const description = ref('');
const price = ref(0);
const amount = ref(1);
const hasChanges = computed(() => description.value !== '' || price.value !== 0);
const total = computed(() => price.value * amount.value);
const canShowDueAt = computed(() => props.showDueAt && (price.value >= 0));

const createdAt = ref(props.showCreatedAt ? new Date() : null);
const dueAt = ref(null);

const priceBreakdown = computed(() => {
    return [{
        name: $t(`341172ee-281e-4458-aeb1-64ed5b2cc8bb`),
        price: total.value,
    }];
});

const chargeViewDescription = computed(() => {
    if (selectionCount.value === null) {
        return '';
    }

    return props.getDescription({ count: selectionCount.value });
});

const saving = ref(false);

const title = $t('e412b71e-566b-41d4-8b1f-97ab7f140b29');

const defaultOrganizationId = computed(() => platform.value.membershipOrganizationId);
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
            message: $t(`c2c395d9-9d50-4680-a973-7d11c5fe000c`),
            field: 'organization',
        }));
    }

    const descriptionNormalized = description.value.trim();

    if (descriptionNormalized.length === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`6223bc9f-b3e9-4cb2-a73e-62555499b6b7`),
            field: 'description',
        }));
    }

    if (price.value === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: $t(`8e1e706c-e42c-49c2-a398-f16ecc649a2b`),
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
        $t('00bdd5bd-af3f-4f83-abe0-696d5b872ca9'),
    );

    if (!isConfirm) {
        saving.value = false;
        return;
    }

    try {
        const limitedFilteredRequest = new LimitedFilteredRequest({
            filter: props.filter,
            limit: 100,
        });

        const body = props.createBody({
            organizationId: selectedOrganization.value!.id,
            price: price.value,
            description: description.value,
            amount: amount.value,
            dueAt: dueAt.value,
            createdAt: createdAt.value,
        });

        await context.value.authenticatedServer.request({
            method: 'POST',
            path: props.chargeEndpointPath,
            query: limitedFilteredRequest,
            shouldRetry: false,
            body,
            owner,
        });

        new Toast($t(`6a753313-f3b7-4999-be86-37fad16ac6d3`), 'success green').show();

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
    return await CenteredMessage.confirm($t('ddf3558e-ed2e-4217-9155-495c3984d769'), $t('f97c98d7-c64e-4cab-ac8f-fdda5b1bfb54'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
