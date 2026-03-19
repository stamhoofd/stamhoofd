<template>
    <div class="container">
        <STErrorsDefault :error-box="errors.errorBox" />

        <TInput v-if="!isSingle" v-model="name" error-fields="name" :error-box="errors.errorBox" :title="$t(`%Gq`)" :placeholder="$t(`%dP`)" />

        <ReduceablePriceInput v-model="groupPrice" :group="group" :error-box="errors.errorBox" :validator="errors.validator" :default-membership-type-id="defaultMembershipTypeId" :start-date="startDate ?? undefined" :external-organization="externalOrganization" />

        <template v-if="!isSingle">
            <hr><h2>{{ $t("%1CP") }}</h2>
        </template>

        <STList>
            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%UC') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('%dI') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%dO', {stock: usedStock.toString()}) }}
                </h3>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <DeprecatedNumberInput v-model="stock" suffix="stuks" suffix-singular="stuk" />
                    </STInputBox>
                </div>
            </STListItem>

            <STListItem v-if="hasStartDate || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hasStartDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1CN') }}
                </h3>

                <div v-if="hasStartDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="startDate" :error-box="errors.errorBox">
                        <DateSelection v-model="startDate" />
                    </STInputBox>
                    <TimeInput v-model="startDate" title="" :validator="errors.validator" />
                </div>
            </STListItem>

            <STListItem v-if="hasEndDate || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hasEndDate" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%1CO') }}
                </h3>

                <div v-if="hasEndDate" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="endDate" :error-box="errors.errorBox">
                        <DateSelection v-model="endDate" />
                    </STInputBox>
                    <TimeInput v-model="endDate" title="" :validator="errors.validator" />
                </div>
            </STListItem>
        </STList>

        <div class="container">
            <hr>
            <h2>{{ $t('%15q') }}</h2>
            <p>{{ $t('%16f') }}</p>

            <STList>
                <STListItem v-for="bundleDiscount of period.settings.bundleDiscounts" :key="bundleDiscount.id" class="right-top" :selectable="true" element-name="label">
                    <template #left>
                        <Checkbox :model-value="getBundleDiscountSelected(bundleDiscount)" @update:model-value="setBundleDiscountSelected(bundleDiscount, $event)" />
                    </template>
                    <h3 class="style-title-list">
                        {{ bundleDiscount.name || $t('%CL') }}
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
                        <button v-if="getOverrideBundleDiscountSelected(bundleDiscount)" v-tooltip="$t('%16g')" type="button" class="button text enabled" @click.prevent="() => setOverrideBundleDiscountSelected(bundleDiscount, false)">
                            <span class="icon sliders" />
                            <span>{{ $t('%16h') }}</span>
                        </button>
                        <button v-else v-tooltip="$t('%16i')" type="button" class="button icon sliders" @click.prevent="() => setOverrideBundleDiscountSelected(bundleDiscount, true)" />
                    </template>
                </STListItem>
            </STList>

            <p>
                <button class="button text" type="button" @click="editBundleDiscounts">
                    <span class="icon edit" />
                    <span>{{ $t('%16j') }}</span>
                </button>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import BundleDiscountSettingsView from '#bundle-discounts/BundleDiscountSettingsView.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useValidation } from '#errors/useValidation.ts';
import type { Validator } from '#errors/Validator.ts';
import GroupPriceDiscountsInput from '#groups/components/GroupPriceDiscountsInput.vue';
import DateSelection from '#inputs/DateSelection.vue';
import DeprecatedNumberInput from '#inputs/DeprecatedNumberInput.vue';
import STInputBox from '#inputs/STInputBox.vue';
import TimeInput from '#inputs/TimeInput.vue';
import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import type { BundleDiscount, Group, GroupPriceDiscount, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { BundleDiscountGroupPriceSettings, GroupPrice } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
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
    validator?: Validator | null;
    externalOrganization?: Organization | null;
}>(), {
    defaultMembershipTypeId: null,
    showNameAlways: false,
    validator: null,
    externalOrganization: null,
});

const emit = defineEmits(['patch:price']);
const { patched, addPatch } = useEmitPatch<GroupPrice>(props, emit, 'price');
const { addPatch: addPeriodPatch } = useEmitPatch<OrganizationRegistrationPeriod>(props, emit, 'period');
const present = usePresent();
const errors = useErrors({ validator: props.validator });

useValidation(errors.validator, () => {
    if (startDate.value && endDate.value && startDate.value >= endDate.value) {
        errors.errorBox = new ErrorBox(new SimpleError({
            code: 'start_date_after_end_date',
            message: $t(`%1CQ`),
        }));

        return false;
    }

    return true;
});

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

const startDate = computed({
    get: () => patched.value.startDate,
    set: startDate => addPatch({ startDate }),
});

const hasStartDate = computed({
    get: () => patched.value.startDate !== null,
    set: (value) => {
        if (value === hasStartDate.value) {
            return;
        }
        if (value) {
            addPatch({
                startDate:
                    startDate.value
                    ?? Formatter.luxon(new Date())
                        .set({
                            hour: 0,
                            minute: 0,
                            second: 0,
                            millisecond: 0,
                        }).toJSDate(),
            });
        }
        else {
            addPatch({ startDate: null });
        }
    },
});

const endDate = computed({
    get: () => patched.value.endDate,
    set: endDate => addPatch({ endDate }),
});

const hasEndDate = computed({
    get: () => patched.value.endDate !== null,
    set: (value) => {
        if (value === hasEndDate.value) {
            return;
        }
        if (value) {
            addPatch({
                endDate: endDate.value
                    ?? Formatter.luxon(new Date())
                        .set({
                            hour: 23,
                            minute: 59,
                            second: 59,
                            millisecond: 999,
                        }).toJSDate(),
            });
        }
        else {
            addPatch({ endDate: null });
        }
    },
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
