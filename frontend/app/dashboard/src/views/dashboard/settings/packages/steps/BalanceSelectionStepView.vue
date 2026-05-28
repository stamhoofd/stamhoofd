<template>
    <SaveView :loading="loading" :error-box="errors.errorBox" save-icon-right="arrow-right" :save-text="$t('%16p')" :title="$t(`%76`)" @save="goNext">
        <h1>{{ title.title }}</h1>
        <p v-if="title.description">
            {{ title.description }}
        </p>

        <STErrorsDefault :error-box="errors.errorBox" />

        <STGrid>
            <STGridItem v-for="item in filteredBalanceItems" :key="item.id" element-name="label" :selectable="canSelect">
                <template #left>
                    <BalanceItemIcon v-if="!canSelect" :item="item" :is-payable="true" />
                    <Checkbox v-else :model-value="isItemSelected(item)" @update:model-value="setItemSelected(item, $event)" />
                </template>

                <BalanceItemTitleBox :item="item" :is-payable="true" />

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
import type { NavigationActions } from '@stamhoofd/components';
import { ErrorBox, useErrors, useNavigationActions, usePositionableSheet } from '@stamhoofd/components';
import STErrorsDefault from '@stamhoofd/components/errors/STErrorsDefault.vue';
import STGrid from '@stamhoofd/components/layout/STGrid.vue';
import STGridItem from '@stamhoofd/components/layout/STGridItem.vue';
import BalanceItemIcon from '@stamhoofd/components/payments/BalanceItemIcon.vue';
import BalanceItemTitleBox from '@stamhoofd/components/payments/BalanceItemTitleBox.vue';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import { BalanceItemStatus  } from '@stamhoofd/structures';
import type {PriceBreakdown, BalanceItem} from '@stamhoofd/structures';
import { computed, onActivated, onMounted, ref } from 'vue';
import { useLoadPayableBalance } from '../../hooks/useLoadPayableBalance';
import type { OrganizationCheckoutViewModel } from '../OrganizationCheckoutViewModel';
import { PayBalanceMode } from '../OrganizationCheckoutViewModel';
import { Formatter } from '@stamhoofd/utility';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { SimpleError } from '@simonbackx/simple-errors';
import DiscountsSheet from '@stamhoofd/components/payments/components/DiscountsSheet.vue';

const props = defineProps<{
    model: OrganizationCheckoutViewModel;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const errors = useErrors();

const title = computed(() => {
    if (canSelect.value) {
        if (props.model.checkout.purchases.empty) {
            return {
                title: $t('%1Sk'),
                description: $t('%1TP')
            }
        }
        return {
            title: $t('%1UQ'),
            description: $t('%1Sn'),
        }
    } else {
        return {
            title:  $t('%1QO'),
            description: $t('%1S6')
        }
    }
})

// todo: update balances exempt status based on invoice settings of the model

const canSelect = computed(() => props.model.payBalanceMode === PayBalanceMode.Optional || props.model.payBalanceMode === PayBalanceMode.Recommended)
const canCustomize = false;

const filteredBalanceItems = computed(() => {
    return props.model.payableBalance.payableBalanceItems;
});

const discounts = computed(() => {
    return props.model.payableBalance.discountBalanceItems;
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

        for (const item of props.model.payableBalance.payableBalanceItems) {
            props.model.checkout.balances.set(item.id, item.priceOpen)
        }
        return;
    }

    for (const [id, val] of props.model.checkout.balances) {
        const f = props.model.payableBalance.payableBalanceItems.find(b => b.id === id)
        if (!f || f.priceOpen <= 0 || val < 0) {
            props.model.checkout.balances.delete(id)
        } else {
            if (val > f.priceOpen) {
                props.model.checkout.balances.set(id, f.priceOpen)
            }
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

const maximumPayable = computed(() => {
    return filteredBalanceItems.value.reduce((a, b) => a + b.priceOpen, 0)
})
const totalAvailableDiscount = computed(() => {
    return discounts.value.reduce((a, b) => a + b.priceOpen, 0)
})
const maximumUsableDiscount = computed(() => {
    if (-totalAvailableDiscount.value < total.value) {
        return totalAvailableDiscount.value
    }
    return -total.value
})

const priceBreakdown = computed(() => {
    const b: PriceBreakdown = [];

    if (totalAvailableDiscount.value !== 0) {
        b.push({
            name: $t(`Tegoed`),
            price: maximumUsableDiscount.value,
            description: -totalAvailableDiscount.value > maximumUsableDiscount.value ? $t('Maximum bruikbaar van in totaal {price} tegoed', {price: Formatter.price(-totalAvailableDiscount.value)}) : '',
            action: {
                icon: 'info-circle',
                handler: showDiscountSheet
            }
        })
    }

    if (b.length) {
        b.unshift({
            name: $t(`Subtotaal`),
            price: total.value,
        })
    }
    return [
        ...b,
        {
            name: $t(`%xL`),
            price: Math.max(0, total.value + maximumUsableDiscount.value),
        },
    ];
});

const { presentPositionableSheet } = usePositionableSheet();

async function showDiscountSheet(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(DiscountsSheet, {
                    items: discounts.value
                }),
            }),
        ],
    }, { minimumHeight: 185, width: 500 });
}


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

        if (props.model.packages.length === 0 && props.model.checkout.balances.size === 0) {
            throw new SimpleError({
                code: 'empty_cart',
                message: 'Cart is empty',
                human: $t('Kies minstens één item om te betalen')
            })
        }

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
