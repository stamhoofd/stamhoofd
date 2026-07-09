<template>
    <STGridItem :selectable="canClick" class="price-grid" @click="clickHandler" v-on="canClick ? { contextmenu: showContextMenu } : {}">
        <template #left>
            <BalanceItemIcon :item="item" :is-payable="isPayable" />
        </template>

        <BalanceItemTitleBox :item="item" :is-payable="isPayable" />

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

            <p v-if="item.pricePaid < 0 && item.price < 0" class="style-price-base negative small">
                {{ $t('%1UY', {price: formatPrice(-item.pricePaid )}) }}
            </p>

            <p v-else-if="item.pricePaid < 0" class="style-price-base negative small">
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
</template>

<script lang="ts" setup>
import { useContext } from '#hooks/useContext.ts';
import STGridItem from '#layout/STGridItem.vue';

import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import type { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ArrayDecoder, PatchableArray } from '@simonbackx/simple-encoding';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import { Toast } from '#overlays/Toast.ts';
import type { GroupedBalanceItems } from '@stamhoofd/structures';
import { BalanceItem, BalanceItemStatus, BalanceItemWithPayments } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';
import { computed } from 'vue';
import { GlobalEventBus } from '../EventBus';
import BalanceItemIcon from './BalanceItemIcon.vue';
import BalanceItemTitleBox from './BalanceItemTitleBox.vue';

const props = withDefaults(
    defineProps<{
        item: BalanceItem | GroupedBalanceItems;
        isPayable: boolean;
        hasWrite?: boolean;
    }>(),
    {
        hasWrite: true,
    },
);

const context = useContext();
const present = usePresent();

const canClick = computed(() => {
    return props.hasWrite && !props.isPayable && props.item instanceof BalanceItem;
});

async function clickHandler() {
    if (!canClick.value) {
        return;
    }

    if (props.item instanceof BalanceItem) {
        await editBalanceItem(props.item);
    }

    // todo: implement for GroupedBalanceItems
}

function showContextMenu(event: MouseEvent) {
    if (!(props.item instanceof BalanceItem)) {
        return;
    }
    event.preventDefault();

    const item = props.item;

    const destructiveItems: ContextMenuItem[] = [];
    if (item.pricePaid === 0 && item.pricePending === 0) {
        destructiveItems.push(new ContextMenuItem({
            name: $t('%CJ'),
            icon: 'trash',
            destructive: true,
            action: () => {
                deleteBalanceItem(item).catch(console.error);
                return true;
            },
        }));
    } else if (item.status !== BalanceItemStatus.Canceled) {
        destructiveItems.push(new ContextMenuItem({
            name: $t('%1Lh'),
            icon: 'canceled',
            destructive: true,
            action: () => {
                cancelBalanceItem(item).catch(console.error);
                return true;
            },
        }));
    }

    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%f9'),
                icon: 'edit',
                action: () => {
                    editBalanceItem(item).catch(console.error);
                    return true;
                },
            }),
            new ContextMenuItem({
                name: $t('%KK'),
                icon: 'copy',
                action: () => {
                    duplicateBalanceItem(item).catch(console.error);
                    return true;
                },
            }),
        ],
        destructiveItems,
    ]);
    menu.show({ clickEvent: event }).catch(console.error);
}

async function editBalanceItem(balanceItem: BalanceItem) {
    const component = AsyncComponent(() => import('#payments/EditBalanceItemView.vue'), {
        balanceItem,
        isNew: false
    });
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: component,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function duplicateBalanceItem(balanceItem: BalanceItem) {
    const duplicate = balanceItem.clone();
    duplicate.id = uuidv4();

    // Reset payment/invoice state so the duplicate starts as a fresh, fully payable item
    duplicate.pricePaid = 0;
    duplicate.pricePending = 0;
    duplicate.priceInvoiced = 0;
    duplicate.paidAt = null;
    duplicate.status = BalanceItemStatus.Due;

    if (duplicate instanceof BalanceItemWithPayments) {
        duplicate.payments = [];
    }

    const component = AsyncComponent(() => import('#payments/EditBalanceItemView.vue'), {
        balanceItem: duplicate,
        isNew: true,
        saveHandler: async () => {
            // Let parent lists know a new balance item was created so they reload
            await GlobalEventBus.sendEvent('balanceItemPatch', duplicate);
        },
    });
    await present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: component,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}

async function cancelBalanceItem(balanceItem: BalanceItem) {
    if (!(await CenteredMessage.confirm({
        title: $t('%1Jx'),
        confirmText: $t('%1Jy'),
        description: $t('%1Jz'),
    }))) {
        return;
    }

    try {
        await doStatusPatch(BalanceItem.patch({
            status: BalanceItemStatus.Canceled,
        }), balanceItem);
        Toast.success($t('%1Js')).show();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function deleteBalanceItem(balanceItem: BalanceItem) {
    if (!(await CenteredMessage.confirm({
        title: $t('%10f'),
        confirmText: $t('%CJ'),
        description: $t('%1Fc'),
    }))) {
        return;
    }

    try {
        await doStatusPatch(BalanceItem.patch({
            status: BalanceItemStatus.Hidden,
            price: 0,
        }), balanceItem);
        Toast.success($t('%1Jt')).show();
    } catch (e) {
        Toast.fromError(e).show();
    }
}

async function doStatusPatch(patch: AutoEncoderPatchType<BalanceItem>, balanceItem: BalanceItem) {
    patch.id = balanceItem.id;

    const arr: PatchableArrayAutoEncoder<BalanceItem> = new PatchableArray();
    arr.addPatch(patch);

    const result = await context.value.authenticatedServer.request({
        method: 'PATCH',
        path: '/organization/balance',
        body: arr,
        decoder: new ArrayDecoder(BalanceItemWithPayments as Decoder<BalanceItemWithPayments>),
        shouldRetry: false,
    });

    if (result.data && result.data.length === 1) {
        balanceItem.deepSet(result.data[0]);
        // Let parent lists know so they reload their totals and filtered items
        await GlobalEventBus.sendEvent('balanceItemPatch', result.data[0]);
    }
}
</script>
