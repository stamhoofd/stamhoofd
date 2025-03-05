<template>
    <div class="container">
        <hr><template v-if="hasMultiplePrices">
            <h2 v-if="showStartDate" class="style-with-button">
                <div>
                    {{ $t('d08f7bd4-bba2-4417-91a9-c91a8581d88b') }} {{ startDate ? formatDate(startDate) : '?' }}
                </div>
                <div>
                    <button class="button text" type="button" @click="emits('delete')">
                        <span class="icon trash"/>
                        <span class="hide-smartphone">{{ $t('838cae8b-92a5-43d2-82ba-01b8e830054b') }}</span>
                    </button>
                </div>
            </h2>
            <h2 v-else>
                {{ $t('1142857f-a695-413c-809e-bafe9c292f2f') }}
            </h2>
        </template>
        
        <STInputBox v-if="showStartDate || startDate" :title="$t('d93bd297-5794-4588-8bfb-17fb2074a364')" :error-box="errorBox">
            <DateSelection v-model="startDate" :required="true" :min="config.startDate" :max="config.endDate" :time="{hours: 0, minutes: 0, seconds: 0}" :placeholder="$t('f19516b2-0c37-4dce-86f4-46690ec3dfc9')"/>
        </STInputBox>

        <STList>
            <STListItem v-for="[tagId, reduceablePrice] of patched.prices" :key="tagId">
                <PlatformMembershipTypeReduceablePriceEditRow :model-value="reduceablePrice" :tag-id="tagId" :show-price-per-day="showPricePerDay" :error-box="errorBox" :validator="validator" @update:model-value="patchReduceablePrice(tagId, $event)">
                    <STInputBox v-if="!tagId && (showPricePerDay || pricePerDay)" :error-box="errorBox" :title="$t(`1122b5e4-5a0c-4648-8769-852778d2309d`)">
                        <PriceInput v-model="pricePerDay" :placeholder="$t(`1122b5e4-5a0c-4648-8769-852778d2309d`)"/>
                    </STInputBox>
                </PlatformMembershipTypeReduceablePriceEditRow>
                <template #right>
                    <div>
                        <button v-if="tagId" class="button text" type="button" @click="deletePriceForTagId(tagId)">
                            <span class="icon trash"/>
                        </button>
                        <button v-else-if="priceConfig.prices.size > 1" class="button text" type="button" :disabled="true">
                            <span class="icon trash"/>
                        </button>
                    </div>
                </template>
            </STListItem>
        </STList>

        <p>
            <button class="button text" type="button" @click="addPriceForTag">
                <span class="icon add"/>
                <span>{{ $t('9ad86597-3455-4837-bfee-249835678f7c') }}</span>
            </button>
        </p>
    </div>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType, PatchMap } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { DateSelection, ErrorBox, OrganizationTagSelectorView, PriceInput, useEmitPatch, Validator } from '@stamhoofd/components';
import { OrganizationTag, PlatformMembershipTypeConfig, PlatformMembershipTypeConfigPrice, ReduceablePrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import PlatformMembershipTypeReduceablePriceEditRow from './PlatformMembershipTypeReduceablePriceEditRow.vue';

const props = defineProps<{
    config: PlatformMembershipTypeConfig;
    priceConfig: PlatformMembershipTypeConfigPrice;
    hasMultiplePrices: boolean;
    showStartDate: boolean;
    showPricePerDay: boolean;
    errorBox: ErrorBox | null;
    validator: Validator;
}>();

const emits = defineEmits<{ (e: 'delete'): void; (e: 'patch:priceConfig'): AutoEncoderPatchType<PlatformMembershipTypeConfigPrice> }>();
const { patched, addPatch } = useEmitPatch<PlatformMembershipTypeConfigPrice>(props, emits, 'priceConfig');

const present = usePresent();

const startDate = computed({
    get: () => patched.value.startDate,
    set: startDate => addPatch({ startDate }),
});

const pricePerDay = computed({
    get: () => patched.value.pricePerDay,
    set: pricePerDay => addPatch({ pricePerDay }),
});

function patchReduceablePrice(tagId: string, reduceablePrice: ReduceablePrice) {
    const map = new PatchMap<string, ReduceablePrice>();
    map.set(tagId, reduceablePrice);
    addPatch({ prices: map });
}

function deletePriceForTagId(tagId: string) {
    const map = new PatchMap<string, ReduceablePrice | null>();
    map.set(tagId, null);
    addPatch({ prices: map });
}

async function addPriceForTag() {
    await present({
        modalDisplayStyle: 'popup',
        components: [
            new ComponentWithProperties(OrganizationTagSelectorView, {
                tagIds: Array.from(patched.value.prices.keys()).filter(id => id !== ''),
                onAdd: async (_allTags: OrganizationTag[], addedTags: OrganizationTag[], deletedTags: OrganizationTag[]) => {
                    const map = new PatchMap<string, ReduceablePrice | null>();

                    addedTags.forEach((tag) => {
                        map.set(tag.id, ReduceablePrice.create({}));
                    });

                    deletedTags.forEach((tag) => {
                        map.set(tag.id, null);
                    });

                    addPatch({ prices: map });
                },
            }),
        ],
    });
}
</script>
