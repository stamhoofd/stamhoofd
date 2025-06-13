<template>
    <div class="container">
        <TInput v-if="!isSingle" v-model="name" error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)" :placeholder="$t(`8435ecfa-0baa-486d-a3fd-b9dafded1cab`)" />

        <ReduceablePriceInput v-model="groupPrice" :group="group" :error-box="errors.errorBox" :validator="errors.validator" :default-membership-type-id="defaultMembershipTypeId" />

        <STList>
            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('6276d07c-bd0d-4117-b46c-e3f7b0dbb1e5') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('9562217e-b18e-480e-ad7f-7fd6596dddd6') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('1fab526d-79d9-4b49-8717-aac1c8a3010a', {stock: usedStock.toString()}) }}
                </h3>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock" suffix="stuks" suffix-singular="stuk" />
                    </STInputBox>
                </div>
            </STListItem>
        </STList>

        <div v-if="$feature('bundle-discounts')" class="container">
            <hr>
            <h2>{{ $t('98237c41-e107-4997-a645-cc4c16bb5b9a') }}</h2>
            <p>{{ $t('3ca1233b-86ba-4291-b0a2-68b0d96031dd') }}</p>

            <STList>
                <STListItem v-for="bundleDiscount of period.settings.bundleDiscounts" :key="bundleDiscount.id" class="right-top" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getBundleDiscountSelected(bundleDiscount)" @update:model-value="setBundleDiscountSelected(bundleDiscount, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ bundleDiscount.name || $t('0a0f4ac1-1b0e-48f0-9f21-d1c77ec3f008') }}
                    </h3>
                    <p class="style-description-small">
                        {{ bundleDiscount.humanDescription }}
                    </p>
                    <p v-if="!getOverrideBundleDiscountSelected(bundleDiscount) && bundleDiscount.discountsText" class="style-description-small">
                        {{ bundleDiscount.discountsText }}
                    </p>

                    <div v-if="getOverrideBundleDiscountSelected(bundleDiscount)" class="split-inputs option" @click.stop>
                        <div>
                            <GroupPriceDiscountsInput :model-value="getCustomBundleDiscounts(bundleDiscount)" @update:model-value="setCustomBundleDiscounts(bundleDiscount, $event)" />
                        </div>
                    </div>

                    <template v-if="getBundleDiscountSelected(bundleDiscount)" #right>
                        <button v-if="getOverrideBundleDiscountSelected(bundleDiscount)" v-tooltip="$t('8545df6d-c416-42dc-88e6-df1eab5c41f9')" type="button" class="button text selected" @click="() => setOverrideBundleDiscountSelected(bundleDiscount, false)">
                            <span class="icon sliders" />
                            <span>{{ $t('eab2f8ba-1f62-4328-a0b6-9593d3b6ca15') }}</span>
                        </button>
                        <button v-else v-tooltip="$t('534fe662-2b92-479c-bb69-2155478673ed')" type="button" class="button icon sliders" @click="() => setOverrideBundleDiscountSelected(bundleDiscount, true)" />
                    </template>
                </STListItem>
            </STList>

            <p>
                <button class="button text" type="button" @click="editBundleDiscounts">
                    <span class="icon edit" />
                    <span>{{ $t('1adf61de-d2d5-45bd-a322-304107173992') }}</span>
                </button>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { BundleDiscountSettingsView, NumberInput, GroupPriceDiscountsInput } from '@stamhoofd/components';
import { BundleDiscount, BundleDiscountGroupPriceSettings, Group, GroupPrice, GroupPriceDiscount, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ReduceablePriceInput } from '..';
import { useErrors } from '../../errors/useErrors';
import { useEmitPatch } from '../../hooks';

const props = withDefaults(defineProps<{
    price: GroupPrice;
    group: Group;
    period: OrganizationRegistrationPeriod;
    errors: ReturnType<typeof useErrors>;
    defaultMembershipTypeId?: string | null;
    showNameAlways?: boolean;
}>(), {
    defaultMembershipTypeId: null,
    showNameAlways: false,
});

const emit = defineEmits(['patch:price']);
const { patched, addPatch } = useEmitPatch<GroupPrice>(props, emit, 'price');
const { addPatch: addPeriodPatch } = useEmitPatch<OrganizationRegistrationPeriod>(props, emit, 'period');
const present = usePresent();

const isSingle = computed(() => !props.showNameAlways && props.group.settings.prices.length <= 1);

const name = computed({
    get: () => patched.value.name,
    set: name => addPatch({ name }),
});
const groupPrice = computed({
    get: () => patched.value.price,
    set: price => addPatch({ price }),
});

const hidden = computed({
    get: () => patched.value.hidden,
    set: hidden => addPatch({ hidden }),
});

const stock = computed({
    get: () => patched.value.stock,
    set: stock => addPatch({ stock }),
});

const usedStock = computed(() => patched.value.getUsedStock(props.group) || 0);

const useStock = computed({
    get: () => patched.value.stock !== null,
    set: useStock => addPatch({ stock: useStock ? (patched.value.getUsedStock(props.group) || 10) : null }),
});

function getBundleDiscountSelected(bundleDiscount: BundleDiscount) {
    return patched.value.bundleDiscounts.has(bundleDiscount.id);
}

function setBundleDiscountSelected(bundleDiscount: BundleDiscount, selected: boolean) {
    if (selected === getBundleDiscountSelected(bundleDiscount)) {
        return;
    }

    const patch = GroupPrice.patch({});

    if (selected) {
        patch.bundleDiscounts.set(
            bundleDiscount.id,
            BundleDiscountGroupPriceSettings.create({
                name: bundleDiscount.name,
            }),
        );
    }
    else {
        patch.bundleDiscounts.set(
            bundleDiscount.id,
            null,
        );
    }

    addPatch(patch);
}

function getOverrideBundleDiscountSelected(bundleDiscount: BundleDiscount) {
    const d = patched.value.bundleDiscounts.get(bundleDiscount.id);
    if (!d) {
        return false;
    }
    return d.customDiscounts !== null;
}

function setOverrideBundleDiscountSelected(bundleDiscount: BundleDiscount, selected: boolean) {
    if (selected === getOverrideBundleDiscountSelected(bundleDiscount)) {
        return;
    }

    const patch = GroupPrice.patch({});

    if (selected) {
        patch.bundleDiscounts.set(
            bundleDiscount.id,
            BundleDiscountGroupPriceSettings.create({
                name: bundleDiscount.name,
                customDiscounts: bundleDiscount.discounts.map(d => d.clone()),
            }),
        );
    }
    else {
        patch.bundleDiscounts.set(
            bundleDiscount.id,
            BundleDiscountGroupPriceSettings.create({
                name: bundleDiscount.name,
                customDiscounts: null,
            }),
        );
    }

    addPatch(patch);
}

function getCustomBundleDiscounts(bundleDiscount: BundleDiscount) {
    return patched.value.bundleDiscounts.get(bundleDiscount.id)?.customDiscounts ?? [];
}

function setCustomBundleDiscounts(bundleDiscount: BundleDiscount, discounts: GroupPriceDiscount[]) {
    const patch = GroupPrice.patch({});

    patch.bundleDiscounts.set(
        bundleDiscount.id,
        BundleDiscountGroupPriceSettings.create({
            name: bundleDiscount.name,
            customDiscounts: discounts.map(d => d.clone()),
        }),
    );

    addPatch(patch);
}

async function editBundleDiscounts() {
    await present({
        components: [
            new ComponentWithProperties(BundleDiscountSettingsView, {
                period: props.period,
                saveHandler: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    addPeriodPatch(patch);
                },
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

</script>
