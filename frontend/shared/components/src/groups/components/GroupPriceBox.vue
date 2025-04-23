<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errors.errorBox" :title="$t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`8435ecfa-0baa-486d-a3fd-b9dafded1cab`)">
        </STInputBox>

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
    </div>
</template>

<script setup lang="ts">
import { NumberInput } from '@stamhoofd/components';
import { Group, GroupPrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ReduceablePriceInput } from '..';
import { useErrors } from '../../errors/useErrors';
import { useEmitPatch } from '../../hooks';

const props = withDefaults(defineProps<{
    price: GroupPrice;
    group: Group;
    errors: ReturnType<typeof useErrors>;
    defaultMembershipTypeId?: string | null;
    showNameAlways?: boolean;
}>(), {
    defaultMembershipTypeId: null,
    showNameAlways: false,
});

const emit = defineEmits(['patch:price']);
const { patched, addPatch } = useEmitPatch<GroupPrice>(props, emit, 'price');
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

</script>
