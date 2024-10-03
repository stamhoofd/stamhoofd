<template>
    <SaveView :title="title" :loading="saving" :disabled="!hasChanges" :save-text="$t('Reken aan')" @save="save">
        <h1 class="style-navigation-title">
            {{ title }}
        </h1>
        <p class="style-description">
            <span v-if="organizationCount === null" class="style-placeholder-skeleton" />
            <span v-else-if="organizationCount === 1">{{ $t("Reken een bedrag aan aan de geselecteerde groep.") }}</span>
            <span v-else>{{ $t('Reken een bedrag aan aan de geselecteerde groepen.', { count: organizationCount.toString() }) }}</span>
        </p>
        <STErrorsDefault :error-box="errors.errorBox" />

        <STInputBox :title="$t('Beschrijving')" error-fields="description" :error-box="errors.errorBox">
            <input v-model="description" class="input" type="text" :placeholder="$t('Beschrijving van de aanrekening')" autocomplete="given-name">
        </STInputBox>

        <STInputBox :title="$t('Bedrag')" error-fields="price" :error-box="errors.errorBox">
            <PriceInput v-model="price" :placeholder="formatPrice(price)" :required="true" />
        </STInputBox>
    </SaveView>
</template>

<script lang="ts" setup>
import { SimpleError, SimpleErrors } from '@simonbackx/simple-errors';
import { usePop } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, ErrorBox, PriceInput, Toast, useContext, useErrors, useValidation } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { useRequestOwner } from '@stamhoofd/networking';
import { LimitedFilteredRequest, StamhoofdFilter } from '@stamhoofd/structures';
import { computed, ref, watch } from 'vue';
import { useCountOrganizations } from './composables/useCountOrganizations';

const props = defineProps<{ filter: StamhoofdFilter }>();

const errors = useErrors();
const $t = useTranslate();
const pop = usePop();
const owner = useRequestOwner();
const context = useContext();
const { count } = useCountOrganizations();

watch(() => props.filter, async (filter) => {
    const result = await count(filter);
    if (result !== null) {
        organizationCount.value = result;
    }
}, { immediate: true });

const organizationCount = ref<number | null>(null);
const description = ref('');
const price = ref(0);
const hasChanges = computed(() => description.value !== '' || price.value !== 0);

const saving = ref(false);

const title = $t('Bedrag aanrekenen');

useValidation(errors.validator, () => {
    const se = new SimpleErrors();

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

    try {
        const limitedFilteredRequest = new LimitedFilteredRequest({
            filter: props.filter,
            limit: 100,
        });

        const body = {
            organizationId: null,
            price: price.value,
            description: description.value,
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
    return await CenteredMessage.confirm($t('Ben je zeker dat je wilt sluiten zonder een bedrag aan te rekenen?'), $t('Niet aanrekenen'));
};

defineExpose({
    shouldNavigateAway,
});
</script>
