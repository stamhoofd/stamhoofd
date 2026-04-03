<template>
    <STErrorsDefault :error-box="ownErrors.errorBox" />
    <div class="split-inputs">
        <PriceInputBox v-model="price" :title="title" error-fields="price" :error-box="errorBox" :min="min" :placeholder="$t(`%1Mn`)" :validator="validator">
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(platformMembershipPrice, platformMembershipPriceNow) }}
            </p>
        </PriceInputBox>

        <PriceInputBox v-if="showReducedPrice" v-model="reducedPrice" :title="financialSupportSettings.priceName" error-fields="price" :error-box="errorBox" :placeholder="formatPrice(price)" :min="min" :required="false" :validator="validator">
            <p v-if="defaultMembershipTypeId" class="style-description-small">
                {{ formatPriceForPlatform(platformMembershipReducedPrice, platformMembershipReducedPriceNow) }}
            </p>
        </PriceInputBox>

        <slot v-else-if="$slots.end" name="end" />
    </div>

    <div v-if="$slots.end && showReducedPrice" class="split-inputs">
        <slot name="end" />
    </div>
</template>

<script setup lang="ts">
import STErrorsDefault from '#errors/STErrorsDefault.vue';
import { useErrors } from '#errors/useErrors.ts';
import { useValidation } from '#errors/useValidation.ts';
import type { Validator } from '#errors/Validator.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { SimpleError } from '@simonbackx/simple-errors';
import type { Group, Organization, ReduceablePrice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { ErrorBox } from '../../errors/ErrorBox';
import PriceInputBox from '../../inputs/PriceInputBox.vue';
import { useFinancialSupportSettings } from '../hooks';

const props = withDefaults(
    defineProps<{
        validator: Validator;
        errorBox?: ErrorBox | null;
        min?: number | null;
        group?: Group | null;
        title?: string;
        defaultMembershipTypeId?: string | null;
        startDate?: Date;
        externalOrganization?: Organization | null;
    }>(),
    {
        errorBox: null,
        min: null,
        title: () => $t(`%1IP`),
        group: null,
        defaultMembershipTypeId: null,
        startDate: () => new Date(0),
        externalOrganization: null,
    },
);
const model = defineModel<ReduceablePrice>({ required: true });
const ownErrors = useErrors();

const platform = usePlatform();
const organzationFromContext = useOrganization();
const organization = computed(() => props.externalOrganization ?? organzationFromContext.value);

const { enabled, financialSupportSettings } = useFinancialSupportSettings({
    group: computed(() => props.group),
    externalOrganization: organization,
});

const showReducedPrice = computed(() => enabled || reducedPrice.value !== null);

const now = computed(() => {
    const date = new Date();

    // now should not be before start date
    if (props.startDate && props.startDate > date) {
        return props.startDate;
    }

    return date;
});

const platformMembershipReducedPrice = computed(() => getPlatformMembershipPrice(true, props.startDate));
const platformMembershipPrice = computed(() => getPlatformMembershipPrice(false, props.startDate));

const platformMembershipReducedPriceNow = computed(() => getPlatformMembershipPrice(true, now.value));
const platformMembershipPriceNow = computed(() => getPlatformMembershipPrice(false, now.value));

const minPriceDifference = computed(() =>
    Math.max(0,
        Math.min(
            // It is possible that the difference changes over the year, so we should allow them to also alter it after this date
            platformMembershipPrice.value - platformMembershipReducedPrice.value,
            platformMembershipPriceNow.value - platformMembershipReducedPriceNow.value,
        ),
    ),
);

function getPlatformMembershipPrice(isReduced: boolean, date: Date) {
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
        return $t('%Bw', { price: Formatter.price(price), priceReduced: Formatter.price(priceNow) });
    }
    return $t('%6h', { price: Formatter.price(price) });
}

useValidation(props.validator, () => {
    if (!enabled.value && model.value.reducedPrice !== null) {
        ownErrors.errorBox = new ErrorBox(new SimpleError({
            code: 'invalid_reduced_price',
            field: 'price',
            message: 'Financial support is not enabled, but you have set a reduced price',
            human: $t('%6i', {
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
            human: $t('%6j', {
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
