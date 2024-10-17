<template>
    <STErrorsDefault :error-box="ownErrors.errorBox" />
    <div class="split-inputs">
        <STInputBox :title="title" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" placeholder="Gratis" :min="min" />
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(defaultPrice) }}
            </p>
        </STInputBox>

        <STInputBox v-if="$showReducedPrice" :title="financialSupportSettings.priceName" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="reducedPrice" :placeholder="formatPrice(price)" :min="min" :required="false" />
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(defaultReducedPrice) }}
            </p>
        </STInputBox>

        <slot v-else-if="$slots.end" name="end" />
    </div>

    <div v-if="$slots.end && $showReducedPrice" class="split-inputs">
        <slot name="end" />
    </div>
</template>

<script setup lang="ts">
import { SimpleError } from '@simonbackx/simple-errors';
import { PriceInput, STErrorsDefault, useErrors, useOrganization, usePlatform, useValidation, Validator } from '@stamhoofd/components';
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { Group, ReduceablePrice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import { useFinancialSupportSettings } from '../hooks';

const props = withDefaults(
    defineProps<{
        validator: Validator;
        errorBox?: ErrorBox | null;
        min?: number | null;
        group?: Group | null;
        title?: string;
        defaultMembershipTypeId?: string | null;
    }>(),
    {
        errorBox: null,
        min: null,
        title: 'Prijs',
        group: null,
        defaultMembershipTypeId: null,
    },
);
const model = defineModel<ReduceablePrice>({ required: true });
const ownErrors = useErrors();
const { enabled, financialSupportSettings } = useFinancialSupportSettings({
    group: computed(() => props.group),
});
const platform = usePlatform();
const organization = useOrganization();
const $t = useTranslate();

const $showReducedPrice = computed(() => enabled || reducedPrice.value !== null);

const defaultReducedPrice = computed(() => getDefaultPrice(true));
const defaultPrice = computed(() => getDefaultPrice(false));
const minPriceDifference = computed(() => defaultPrice.value - defaultReducedPrice.value);

function getDefaultPrice(isReduced: boolean) {
    if (!props.defaultMembershipTypeId) {
        return 0;
    }

    const defaultMembershipTypeId = props.defaultMembershipTypeId;
    const defaultMembership = platform.value.config.membershipTypes.find(mt => mt.id === defaultMembershipTypeId);
    if (!defaultMembership) {
        return 0;
    }

    return defaultMembership.getPrice(platform.value.period.id, new Date(), organization.value?.meta.tags ?? [], isReduced) ?? 0;
}

function formatPriceForPlatform(price: number) {
    return $t('75815048-939a-4ac1-a81c-f23fc3ec5006', {price: Formatter.price(price)});
}

useValidation(props.validator, () => {
    if (!enabled.value && model.value.reducedPrice !== null) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reduced_price',
            field: 'price',
            message: 'Financial support is not enabled, but you have set a reduced price',
            human: $t("a83523bb-ba90-4a6c-a73a-4d4f12defe7a", {
                financialSupportTitle: financialSupportSettings.value.title,
                financialSupportPriceName: financialSupportSettings.value.priceName
            }),
        }));
        return false;
    }

    if (model.value.reducedPrice !== null
        && (model.value.price - model.value.reducedPrice) < minPriceDifference.value) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reduced_price',
            field: 'price',
            message: 'Reduced price should be at least be the normal price minus the minimum difference between the normal and reduced price',
            human: $t("77578f4e-049c-4d64-b63c-357fb6d0d7ac", {
                financialSupportPriceName: financialSupportSettings.value.priceName,
                minDifference: Formatter.price(minPriceDifference.value),
            }),
        }));
        return false;
    }

    ownErrors.errorBox = null;
    return true;
}, 'price');

const price = computed({
    get: () => model.value.price,
    set: price => model.value = model.value.patch({ price }),
});
const reducedPrice = computed({
    get: () => model.value.reducedPrice,
    set: reducedPrice => model.value = model.value.patch({ reducedPrice }),
});
</script>
