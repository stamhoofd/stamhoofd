<template>
    <div>
        <STInputBox v-if="!isSingle" error-fields="name" :error-box="errors.errorBox" :title="$t(`d32893b7-c9b0-4ea3-a311-90d29f2c0cf3`)">
            <input v-model="name" class="input" type="text" autocomplete="off" :placeholder="$t(`3a678ff7-2467-4341-89a3-4e01e7698f3b`)"></STInputBox>

        <ReduceablePriceInput v-model="groupPrice" :group="group" :error-box="errors.errorBox" :validator="errors.validator" :default-membership-type-id="defaultMembershipTypeId"/>

        <STList>
            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('4fe2a3a7-c314-4566-a47a-4221c79f790d') }}
                </h3>
                <p v-if="hidden" class="style-description-small">
                    {{ $t('a1257c6d-92d8-403a-b361-cdf1dbc8fbe3') }}
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock"/>
                </template>

                <h3 class="style-title-list">
                    {{ $t('083ceff7-ae68-4bd8-871a-6e4002991513') }} {{ usedStock }} {{ $t('dd8428ad-8fdd-4fc5-ac64-08ededeba0f1') }}
                </h3>

                <div v-if="useStock" class="split-inputs option" @click.stop.prevent>
                    <STInputBox title="" error-fields="stock" :error-box="errors.errorBox">
                        <NumberInput v-model="stock" suffix="stuks" suffix-singular="stuk"/>
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
