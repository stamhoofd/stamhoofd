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

        <STList>
            <STListItem v-for="[tagId, reduceablePrice] of patched.prices" :key="tagId">
                <PlatformMembershipTypeReduceablePriceEditRow
                    :model-value="reduceablePrice"
                    :tag-id="tagId"
                    :show-price-per-day="showPricePerDay"
                    :error-box="errorBox" :validator="validator"
                    @update:model-value="patchReduceablePrice(tagId, $event)"
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
                </PlatformMembershipTypeReduceablePriceEditRow>
                <template #right>
                    <div>
                        <button v-if="tagId" class="button text" type="button" @click="deletePriceForTagId(tagId)">
                            <span class="icon trash" />
                        </button>
                        <button v-else-if="priceConfig.prices.size > 1" class="button text" type="button" :disabled="true">
                            <span class="icon trash" />
                        </button>
                    </div>
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPriceForTag">
                <span class="icon add" />
                <span>{{ $t('admin.settings.membershipTypes.period.addPriceForTag') }}</span>
            </button>
        </p>
    </div>
</template>


<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { DateSelection, ErrorBox, PriceInput, useEmitPatch, Validator } from '@stamhoofd/components';
import { OrganizationTag, PlatformMembershipTypeConfigPrice, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import OrganizationTagSelectorView from './OrganizationTagSelectorView.vue';
import PlatformMembershipTypeReduceablePriceEditRow from './PlatformMembershipTypeReduceablePriceEditRow.vue';

const props = defineProps<{
    priceConfig: PlatformMembershipTypeConfigPrice,
    hasMultiplePrices: boolean;
    showStartDate: boolean;
    showPricePerDay: boolean;
    errorBox: ErrorBox | null;
    validator: Validator;
}>();

const emits = defineEmits<{(e: 'delete'): void, (e: 'patch:priceConfig'): AutoEncoderPatchType<PlatformMembershipTypeConfigPrice>}>();
const {patched, addPatch} = useEmitPatch<PlatformMembershipTypeConfigPrice>(props, emits, 'priceConfig');

const present = usePresent();

const $startDate = computed({
    get: () => patched.value.startDate,
    set: (startDate) => addPatch({startDate}),
});

const $pricePerDay = computed({
    get: () => patched.value.pricePerDay,
    set: (pricePerDay) => addPatch({pricePerDay}),
})

function patchReduceablePrice(tagId: string, reduceablePrice: ReduceablePrice) {
    const map = new PatchMap<string, ReduceablePrice>();
    map.set(tagId, reduceablePrice);
    addPatch({prices: map});
}

function deletePriceForTagId(tagId: string) {
    const map = new PatchMap<string, ReduceablePrice | null>();
    map.set(tagId, null);
    addPatch({prices: map});
}

async function addPriceForTag() {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(OrganizationTagSelectorView, {
                tagIds: Array.from(patched.value.prices.keys()).filter(id => id !== ''),
                onAdd: async (_allTags: OrganizationTag[], addedTags: OrganizationTag[], deletedTags: OrganizationTag[]) => {
                    const map = new PatchMap<string, ReduceablePrice | null>();

                    addedTags.forEach(tag => {
                        map.set(tag.id, ReduceablePrice.create({}));
                    });
                    
                    deletedTags.forEach(tag => {
                        map.set(tag.id, null)
                    });

                    addPatch({prices: map});
                }
            })
        ]
    });
}
</script>
