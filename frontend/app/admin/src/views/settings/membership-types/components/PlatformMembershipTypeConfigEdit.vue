<template>
    <div class="container">
        <hr>

        <template v-if="hasMultiplePrices">
            <h2 v-if="showStartDate" class="style-with-button">
                <div>
                    Prijs vanaf {{ $startDate ? formatDate($startDate) : '?' }}
                </div>
                <div>
                    <button class="button text" type="button" @click="emits('delete')">
                        <span class="icon trash" />
                        <span class="hide-smartphone">{{ $t('Verwijderen') }}</span>
                    </button>
                </div>
            </h2>
            <h2 v-else>
                Standaardprijs
            </h2>
        </template>

        <STInputBox
            v-if="showStartDate || $startDate"
            :title="$t('admin.settings.membershipTypes.period.priceDate')" :error-box="errorBox"
        >
            <DateSelection
                v-model="$startDate" :required="false"
                :placeholder="$t('admin.settings.membershipTypes.expireDate.placeholder')"
            />
        </STInputBox>

        <div v-for="[tagId, reduceablePrice] of model.prices" :key="tagId">
            <PlatformMembershipTypeConfigPriceRow
                :model-value="reduceablePrice"
                :tag-id="tagId"
                :show-price-per-day="showPricePerDay"
                :error-box="errorBox" :validator="validator"
                @update:model-value="patchReduceablePrice(tagId, $event)"
                @delete="deletePriceForTagId(tagId)"
            >
                <STInputBox
                    v-if="!tagId && (showPricePerDay || $pricePerDay)"
                    title="Prijs per dag" :error-box="errorBox"
                >
                    <PriceInput
                        v-model="$pricePerDay"
                        placeholder="Prijs per dag"
                    />
                </STInputBox>
            </PlatformMembershipTypeConfigPriceRow>
        </div>

        <p>
            <button class="button text" type="button" @click="addPriceForTag">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.period.addPriceForTag') }}</span>
            </button>
        </p>
    </div>
</template>


<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { DateSelection, ErrorBox, PriceInput, usePatchMap, Validator } from '@stamhoofd/components';
import { OrganizationTag, PlatformMembershipTypeConfigPrice, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import OrganizationTagSelector from './OrganizationTagSelector.vue';
import PlatformMembershipTypeConfigPriceRow from './PlatformMembershipTypeConfigPriceEdit.vue';

defineProps<{
    hasMultiplePrices: boolean;
    showStartDate: boolean;
    showPricePerDay: boolean;
    errorBox: ErrorBox | null;
    validator: Validator;
}>();

const model = defineModel<PlatformMembershipTypeConfigPrice>({required: true});

const emits = defineEmits<{(e: 'delete'): void}>();
const present = usePresent();

// const {patched, addPatch, hasChanges, patch} = usePatch(props.priceConfig);
const {addPut: addPricePut, addDelete: addDeletePrice, patch: $pricesPatch} = usePatchMap(model.value.prices);

const $startDate = computed({
    get: () => model.value.startDate,
    set: (startDate) => model.value = model.value.patch({startDate}),
});

const $pricePerDay = computed({
    get: () => model.value.pricePerDay,
    set: (pricePerDay) => model.value = model.value.patch({pricePerDay}),
})

function patchReduceablePrice(tagId: string, reduceablePrice: ReduceablePrice) {
    console.warn('patch reduceable price')
    addPricePut(tagId, reduceablePrice);
    model.value = model.value.patch({prices: $pricesPatch.value})
}

async function addPriceForTag() {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(OrganizationTagSelector, {
                tagIds: Array.from(model.value.prices.keys()).filter(id => id !== ''),
                onAdd: async (_allTags: OrganizationTag[], addedTags: OrganizationTag[], deletedTags: OrganizationTag[]) => {
                    addedTags.forEach(tag => addPriceForTagId(tag.id));
                    deletedTags.forEach(tag => deletePriceForTagId(tag.id));
                }
            })
        ]
    });
}

function addPriceForTagId(tagId: string) {
    addPricePut(tagId, ReduceablePrice.create({}));
    model.value = model.value.patch({prices: $pricesPatch.value})
}

function deletePriceForTagId(agId: string) {
    addDeletePrice(agId);
    model.value = model.value.patch({prices: $pricesPatch.value})
}
</script>
