<template>
    <SaveView :loading="loading" :error-box="errors.errorBox" save-icon-right="arrow-right" :save-text="$t('%16p')" :title="$t(`Openstaand bedrag`)" @save="goNext">
        <h1>{{ title.title }}</h1>
        <p v-if="title.description">
            {{ title.description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STGrid>
            <STGridItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="true">
                <template #left>
                    <BalanceItemIcon v-if="!canSelect" :item="item" :is-payable="true" />
                    <Checkbox v-else :model-value="isItemSelected(item)" @update:model-value="setItemSelected(item, $event)" />
                </template>

                <BalanceItemTitleBox :item="item" :is-payable="true" />

                <!--<div v-if="isItemSelected(item) && canCustomize" class="split-inputs option" @click.stop>
                        <div>
                            <STInputBox :title="item.priceOpen >= 0 ? $t('%16x') : $t('%16y')">
                                <PriceInput :currency="getItemValue(item) === item.priceOpen ? 'euro' : ('/ ' + formatFloat(Math.abs(item.priceOpen) / 100_00) + ' euro')" :model-value="Math.abs(getItemValue(item))" :min="0" :max="Math.abs(item.priceOpen)" :placeholder="$t(`%2X`)" @update:model-value="setItemValue(item, Math.abs($event) * Math.sign(item.priceOpen))" />
                            </STInputBox>
                        </div>
                    </div>
                    <p v-else class="style-description">
                        <span v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                            ({{ formatPrice(item.priceOpen) }})
                        </span>
                        <span v-else class="style-price-base" :class="{negative: item.priceOpen < 0}">
                            {{ formatPrice(item.priceOpen) }}
                        </span>
                    </p>

                    <template #right>
                        <BalanceItemIcon :item="item" :is-payable="true" />
                    </template>-->

                <template v-if="item.status === BalanceItemStatus.Canceled || item.amount" #middleRight>
                    <p v-if="item.status === BalanceItemStatus.Canceled" class="style-price-base negative">
                        -
                    </p>

                    <p v-else class="style-price-base">
                        {{ formatFloat(item.amount) }}
                    </p>
                </template>

                <template #right>
                    <p v-if="!item.isDue" v-tooltip="item.dueAt ? ('Te betalen tegen ' + formatDate(item.dueAt)) : undefined" class="style-price-base disabled style-tooltip">
                        ({{ formatPrice(item.price) }})
                    </p>
                    <p v-else class="style-price-base" :class="{negative: item.price < 0}">
                        {{ formatPrice(item.price) }}
                    </p>

                    <p v-if="item.pricePaid < 0" class="style-price-base negative small">
                        {{ $t('%1Kc', {price: formatPrice(-item.pricePaid )}) }}
                    </p>

                    <p v-if="item.pricePaid > 0" class="style-price-base negative small">
                        {{ $t('%gi', {price: formatPrice(-item.pricePaid )}) }}
                    </p>

                    <p v-if="item.pricePending < 0" class="style-price-base disabled negative small">
                        {{ $t('%1Kd', {price: formatPrice(-item.pricePending)}) }}
                    </p>

                    <p v-if="item.pricePending > 0" class="style-price-base disabled negative small">
                        {{ $t('%gj', {price: formatPrice(-item.pricePending)}) }}
                    </p>
                </template>
            </STGridItem>
        </STGrid>

        <PriceBreakdownBox :price-breakdown="priceBreakdown" />
    </SaveView>
</template>

<script setup lang="ts">
import type { Decoder } from '@simonbackx/simple-encoding';
import { ErrorBox, useContext, useErrors, useNavigationActions  } from '@stamhoofd/components';
import type {NavigationActions} from '@stamhoofd/components';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import BalanceItemTitleBox from '@stamhoofd/components/payments/BalanceItemTitleBox.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { useRequestOwner } from '@stamhoofd/networking';
import { BalanceItem, BalanceItemStatus, DetailedPayableBalance } from '@stamhoofd/structures';
import { computed, onActivated, onMounted, ref } from 'vue';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';
import { PayBalanceMode } from '../OrganizationCheckoutViewModel';
import BalanceItemIcon from '@stamhoofd/components/payments/BalanceItemIcon.vue';
import { useLoadPayableBalance } from '../../hooks/useLoadPayableBalance';

const props = defineProps<{
    model: OrganizationCheckoutViewModel;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const context = useContext();
const owner = useRequestOwner();
const errors = useErrors();

const title = computed(() => {
    if (canSelect.value) {
        if (props.model.checkout.purchases.empty) {
            return {
                title: $t('Wat wil je betalen?'),
                description: $t('Alle prijzen zijn inclusief BTW.')
            }
        }
        return {
            title: $t('Betaal je dit meteen ook?'),
            description: $t('Deze items stonden nog op ‘te betalen’. Bespaar jezelf wat werk door deze mee af te rekenen. Alle prijzen zijn inclusief BTW.'),
        }
    } else {
        return {
            title:  $t('Dit rekenen we mee af'),
            description: $t('Deze items stonden nog open en zullen mee aangerekend worden. Alle prijzen zijn inclusief BTW.')
        }
    }
})

// todo: update balances exempt status based on invoice settings of the model

const canSelect = computed(() => props.model.payBalanceMode === PayBalanceMode.Optional || props.model.payBalanceMode === PayBalanceMode.Recommended)
const canCustomize = false;

const filteredBalanceItems = computed(() => {
    return BalanceItem.filterBalanceItems(props.model.payableBalance.balanceItems);
});

function isItemSelected(item: BalanceItem) {
    return props.model.checkout.balances.has(item.id)
}

function setItemSelected(item: BalanceItem, selected: boolean) {
    if (isItemSelected(item) === selected) {
        return;
    }
    if (!selected) {
        props.model.checkout.balances.delete(item.id)
    } else {
        props.model.checkout.balances.set(item.id, item.priceOpen)
    }
}

function getItemValue(item: BalanceItem) {
    return props.model.checkout.balances.get(item.id) ?? 0;
}

function setItemValue(item: BalanceItem, price: number) {
    setItemSelected(item, true);
    if (item.priceOpen >= 0 && price > item.priceOpen) {
        price = item.priceOpen
    }
    if (item.priceOpen >= 0 && price < 0) {
        price = 0
    }

    if (item.priceOpen < 0 && price < item.priceOpen) {
        price = item.priceOpen
    }

    if (item.priceOpen < 0 && price > 0) {
        price = 0
    }

    props.model.checkout.balances.set(item.id, price);
}

function clean() {
    if (props.model.payBalanceMode === PayBalanceMode.None) {
        props.model.checkout.balances.clear()
        return;
    }

    if (props.model.payBalanceMode === PayBalanceMode.Required) {
        props.model.checkout.balances.clear()

        for (const item of props.model.payableBalance.filteredBalanceItems) {
            props.model.checkout.balances.set(item.id, item.priceOpen)
        }
        return;
    }

    for (const [id] of props.model.checkout.balances) {
        if (!props.model.payableBalance.filteredBalanceItems.find(b => b.id === id)) {
            props.model.checkout.balances.delete(id)
        }
    }
}

const loadPayableBalance = useLoadPayableBalance()
async function reloadPayableBalance() {
    try {
        const data = await loadPayableBalance(props.model.sellingOrganization.id)
        props.model.payableBalance.deepSet(data)
        clean()
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

onMounted(() => {
    clean()

    if (props.model.payBalanceMode === PayBalanceMode.Recommended) {
        props.model.checkout.balances.clear()

        for (const item of props.model.payableBalance.filteredBalanceItems) {
            props.model.checkout.balances.set(item.id, item.priceOpen)
        }
    }

    reloadPayableBalance().catch(console.error)
});

onActivated(() => {
    clean()
    reloadPayableBalance().catch(console.error)
});

const total = computed(() => {
    return [...props.model.checkout.balances.values()].reduce((total, item) => total + item, 0);
});

const priceBreakdown = computed(() => {
    return [
        {
            name: $t(`%xL`),
            price: total.value,
        },
    ];
});

const loading = ref(false);
const navigate = useNavigationActions();

async function goNext() {
    if (loading.value) {
        return;
    }

    clean()
    loading.value = true;
    errors.errorBox = null;

    try {
        // Check packages are fine (throws if renew or activation is not possible)
        props.model.validate();

        // todo: validate and modify checkout
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}


</script>
