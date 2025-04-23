<template>
    <STErrorsDefault :error-box="ownErrors.errorBox" />
    <div class="split-inputs">
        <STInputBox :title="title" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="price" :min="min" :placeholder="$t(`99e41cea-bce3-4329-8b17-e3487c4534ac`)" />
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(defaultPrice, defaultPriceNow) }}
            </p>
        </STInputBox>

        <STInputBox v-if="$showReducedPrice" :title="financialSupportSettings.priceName" error-fields="price" :error-box="errorBox">
            <PriceInput v-model="reducedPrice" :placeholder="formatPrice(price)" :min="min" :required="false" />
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(defaultReducedPrice, defaultReducedPriceNow) }}
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
        title: $t(`Prijs`),
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

const defaultReducedPrice = computed(() => getDefaultPrice(true, new Date(0)));
const defaultPrice = computed(() => getDefaultPrice(false, new Date(0)));

const defaultReducedPriceNow = computed(() => getDefaultPrice(true, new Date()));
const defaultPriceNow = computed(() => getDefaultPrice(false, new Date()));

const minPriceDifference = computed(() =>
    Math.max(0,
        Math.min(
            // It is possible that the difference changes over the year, so we should allow them to also alter it after this date
            defaultPrice.value - defaultReducedPrice.value,
            defaultPriceNow.value - defaultReducedPriceNow.value,
        ),
    ),
);

function getDefaultPrice(isReduced: boolean, date: Date) {
    if (!props.defaultMembershipTypeId) {
        return 0;
    }

    const defaultMembershipTypeId = props.defaultMembershipTypeId;
    const defaultMembership = platform.value.config.membershipTypes.find(mt => mt.id === defaultMembershipTypeId);
    if (!defaultMembership) {
        return 0;
    }

    return defaultMembership.getPrice(platform.value.period.id, date, organization.value?.meta.tags ?? [], isReduced) ?? 0;
}

function formatPriceForPlatform(price: number, priceNow: number) {
    if (priceNow < price) {
        return $t('f6e06abd-3e58-4f99-bc8d-6cf6a44273b3', { price: Formatter.price(price), priceReduced: Formatter.price(priceNow) });
    }
    return $t('75815048-939a-4ac1-a81c-f23fc3ec5006', { price: Formatter.price(price) });
}

useValidation(props.validator, () => {
    if (!enabled.value && model.value.reducedPrice !== null) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reduced_price',
            field: 'price',
            message: 'Financial support is not enabled, but you have set a reduced price',
            human: $t('a83523bb-ba90-4a6c-a73a-4d4f12defe7a', {
                financialSupportTitle: financialSupportSettings.value.title,
                financialSupportPriceName: financialSupportSettings.value.priceName,
            }),
        }));
        return false;
    }

    if (model.value.reducedPrice !== null && model.value.reducedPrice !== 0
        && (model.value.price - model.value.reducedPrice) < minPriceDifference.value
    ) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reduced_price',
            field: 'price',
            message: 'Reduced price should be at least be the normal price minus the minimum difference between the normal and reduced price',
            human: $t('77578f4e-049c-4d64-b63c-357fb6d0d7ac', {
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
