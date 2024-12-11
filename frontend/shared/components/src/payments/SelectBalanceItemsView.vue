<template>
    <SaveView :error-box="errors.errorBox" :loading="saving" :title="title" :disabled="total == 0" save-text="Betalen" save-icon-right="arrow-right" @save="save">
        <h1>{{ title }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />
        <SelectBalanceItemsList :items="items" :list="list" @patch="addPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

const props = defineProps<{
    title: string;
    items: BalanceItem[];
    saveHandler: (list: BalanceItemPaymentDetailed[]) => void | Promise<void>;
}>();

const list = ref([] as BalanceItemPaymentDetailed[]);
const errors = useErrors();
const saving = ref(false);

const total = computed(() => {
    return list.value.reduce((total, item) => total + item.price, 0);
});

for (const item of props.items) {
    if (item.dueAt === null || item.dueAt <= new Date()) {
        list.value.push(BalanceItemPaymentDetailed.create({
            balanceItem: item,
            price: item.priceOpen,
        }));
    }
}

function addPatch(p: PatchableArrayAutoEncoder<BalanceItemPaymentDetailed>) {
    list.value = p.applyTo(list.value);
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;
    try {
        errors.errorBox = null;
        await props.saveHandler(list.value);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
