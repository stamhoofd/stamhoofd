<template>
    <SaveView :error-box="errors.errorBox" :loading="saving" :title="title" :disabled="total == 0" :save-text="$t('e3f37ccd-a27c-4455-96f4-e33b74ae879e')" save-icon-right="arrow-right" @save="save">
        <h1>{{ title }}</h1>
        <STErrorsDefault :error-box="errors.errorBox" />
        <SelectBalanceItemsList :items="items" :list="list" :is-payable="isPayable" :can-customize-item-value="canCustomizeItemValue" @patch="addPatch" />
    </SaveView>
</template>

<script setup lang="ts">
import { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { BalanceItem, BalanceItemPaymentDetailed } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import { ErrorBox } from '../errors/ErrorBox';
import { useErrors } from '../errors/useErrors';
import { NavigationActions, useNavigationActions } from '../types/NavigationActions';
import SelectBalanceItemsList from './SelectBalanceItemsList.vue';

const props = defineProps<{
    title: string;
    items: BalanceItem[];
    isPayable: boolean;
    saveHandler: (navigate: NavigationActions, list: BalanceItemPaymentDetailed[]) => void | Promise<void>;
    canCustomizeItemValue?: (item: BalanceItem) => boolean;
}>();

const list = ref([] as BalanceItemPaymentDetailed[]);
const errors = useErrors();
const saving = ref(false);
const navigate = useNavigationActions();

const total = computed(() => {
    return list.value.reduce((total, item) => total + item.price, 0);
});

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
        await props.saveHandler(navigate, list.value);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

</script>
