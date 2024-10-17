<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :save-text="$t('00bdd5bd-af3f-4f83-abe0-696d5b872ca9')" save-icon="calculator" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>

        <p class="style-description">
            <span v-if="organizationCount === null" class="style-placeholder-skeleton" />
            <span v-else-if="organizationCount === 1">{{ $t("51c27c5e-c2be-441b-a571-7bf573ee6848") }}</span>
            <span v-else>{{ $t('88119ffc-b692-4222-8217-75a9fa64f675', { count: organizationCount.toString() }) }}</span>
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('4a5ca65c-3a96-4ca0-991c-518a9e92adb7')" error-fields="organization" :error-box="errors.errorBox">
            <OrganizationSelect v-model="selectedOrganization" />
        </STInputBox>

        <STInputBox :title="$t('11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c')" error-fields="description" :error-box="errors.errorBox">
            <input v-model="description" class="input" type="text" :placeholder="$t('e4a32f97-64aa-43d7-803f-3d18f7cdf8e4')" autocomplete="given-name">
        </STInputBox>

        <div class="split-inputs">
            <STInputBox :title="$t('7453643b-fdb2-4aa1-9964-ddd71762c983')" error-fields="price" :error-box="errors.errorBox">
                <PriceInput v-model="price" :placeholder="formatPrice(0)" :required="true" />
            </STInputBox>
            <STInputBox :title="$t('a0f52fae-a4e6-4c3c-a6af-83218dd399b2')" error-fields="amount" :error-box="errors.errorBox">
                <NumberInput v-model="amount" :title="$t('a0f52fae-a4e6-4c3c-a6af-83218dd399b2')" :validator="errors.validator" :min="1" />
            </STInputBox>
        </div>

        <PriceBreakdownBox :price-breakdown="priceBreakdown" />
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, NumberInput, PriceBreakdownBox, PriceInput, Toast, useContext, useErrors, useExternalOrganization, usePlatform, useValidation } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { LimitedFilteredRequest, Organization, StamhoofdFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, Ref, ref, watch } from 'vue';
import OrganizationSelect from './components/OrganizationSelect.vue';
import { useCountOrganizations } from './composables/useCountOrganizations';

const props = defineProps<{ filter: StamhoofdFilter }>();

const errors = useErrors();
const $t = useTranslate();
const pop = usePop();
const owner = useRequestOwner();
const context = useContext();
const platform = usePlatform();
const { count } = useCountOrganizations();

count(props.filter)
    .then((result) => {
        if (result !== null) {
            organizationCount.value = result;
        }
    })
    .catch(console.error);

const organizationCount = ref<number | null>(null);
const selectedOrganization: Ref<Organization | null> = ref(null);
const description = ref('');
const price = ref(0);
const amount = ref(1);
const hasChanges = computed(() => description.value !== '' || price.value !== 0);
const total = computed(() => price.value * amount.value);
const priceBreakdown = computed(() => {
    return [{
        name: 'Totaal',
        price: total.value,
    }];
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
            message: 'Organisatie is verplicht',
            field: 'organization',
        }));
    }

    const descriptionNormalized = description.value.trim();

    if (descriptionNormalized.length === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Beschrijving is verplicht',
            field: 'description',
        }));
    }

    if (price.value === 0) {
        se.addError(new SimpleError({
            code: 'invalid_field',
            message: 'Bedrag kan niet 0 zijn',
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

    const isConfirm = await CenteredMessage.confirm(
        $t('9305016a-babf-4606-af6c-e8ef9f2ba91e', {
            total: Formatter.price(total.value),
            count: organizationCount.value?.toString() ?? '?',
        }),
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

        const body = {
            organizationId: selectedOrganization.value!.id,
            price: price.value,
            description: description.value,
            amount: amount.value,
        };

        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/admin/charge-organizations',
            query: limitedFilteredRequest,
            shouldRetry: false,
            body,
            owner,
        });

        new Toast('Het bedrag werd aangerekend', 'success green').show();

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
