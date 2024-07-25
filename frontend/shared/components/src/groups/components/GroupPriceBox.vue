<template>
    <div>
        <STInputBox v-if="!isSingle" title="Naam" error-fields="name" :error-box="errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van dit tarief"
                autocomplete=""
            >
        </STInputBox>

        <ReduceablePriceInput v-model="groupPrice" :error-box="errorBox" />
    </div>
</template>

<script setup lang="ts">
import { Group, GroupPrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ReduceablePriceInput } from '..';
import { ErrorBox } from '../../errors/ErrorBox';
import { useEmitPatch } from '../../hooks';

const props = defineProps<{
    price: GroupPrice,
    group: Group,
    errorBox: ErrorBox|null
}>();

const emit = defineEmits(['patch:price'])
const {patched, addPatch} = useEmitPatch<GroupPrice>(props, emit, 'price');
const isSingle = computed(() => props.group.settings.prices.length <= 1);

const name = computed({
    get: () => patched.value.name,
    set: (name) => addPatch({name})
})
const groupPrice = computed({
    get: () => patched.value.price,
    set: (price) => addPatch({price})
})

</script>
