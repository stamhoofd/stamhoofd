<template>
    <div>
        <STInputBox v-if="!isSingle" title="Naam" error-fields="name" :error-box="errors.errorBox">
            <input
                v-model="name"
                class="input"
                type="text"
                placeholder="Naam van dit tarief"
                autocomplete=""
            >
        </STInputBox>

        <ReduceablePriceInput v-model="groupPrice" :error-box="errors.errorBox" />

        <STList>
            <STListItem v-if="!isSingle || hidden" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="hidden" />
                </template>

                <h3 class="style-title-list">
                    Verborgen
                </h3>
                <p v-if="hidden" class="style-description-small">
                    Deze keuze wordt onzichtbaar in het ledenportaal en is enkel manueel toe te voegen door een beheerder.
                </p>
            </STListItem>

            <STListItem v-if="useStock || !isSingle" :selectable="true" element-name="label">
                <template #left>
                    <Checkbox v-model="useStock" />
                </template>

                <h3 class="style-title-list">
                    Beperk het beschikbare aantal stuks (waarvan nu {{ usedStock }} ingenomen of gereserveerd)
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
import { NumberInput } from "@stamhoofd/components";
import { Group, GroupPrice } from '@stamhoofd/structures';
import { computed } from 'vue';
import { ReduceablePriceInput } from '..';
import { useErrors } from '../../errors/useErrors';
import { useEmitPatch } from '../../hooks';

const props = defineProps<{
    price: GroupPrice,
    group: Group,
    errors: ReturnType<typeof useErrors>
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

const hidden = computed({
    get: () => patched.value.hidden,
    set: (hidden) => addPatch({hidden})
})

const stock = computed({
    get: () => patched.value.stock,
    set: (stock) => addPatch({stock})
})

const usedStock = computed(() => patched.value.getUsedStock(props.group) || 0);

const useStock = computed({
    get: () => patched.value.stock !== null,
    set: (useStock) => addPatch({stock: useStock ? (patched.value.getUsedStock(props.group) || 10) : null})
})

</script>
