<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`%1DQ`)" />
        <main class="center">
            <h1>
                {{ $t('%1DQ') }}
            </h1>

            <p v-if="cart.price">
                {{ $t('%X6') }}
            </p>
            <p v-else>
                {{ $t('%X7') }}
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="cart.isEmpty" class="info-box">
                {{ $t("%XA") }}
            </p>

            <template v-else>
                <STList>
                    <RegisterItemRow v-for="item in cart.items" :key="item.id" class="right-stack" :item="item" />
                    <BalanceItemCartItemRow v-for="item in visibleBalanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout" />
                </STList>
                <PriceBreakdownBox :price-breakdown="checkout.getPriceBreakown({balanceItemDiscountsAction: {icon: 'info-circle', handler: showDiscountSheet}})" />

                <p class="style-button-bar right-align">
                    <LoadingButton :loading="loading || loadingBalances">
                        <button class="button primary" type="button" data-testid="go-to-checkout-button" @click="goToCheckout">
                            <span v-if="checkout.totalPrice">{{ $t('%X8') }}</span>
                            <span v-else>{{ $t('%X9') }}</span>

                            <span class="icon arrow-right" />
                        </button>
                    </LoadingButton>
                </p>
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
import BalanceItemCartItemRow from '@stamhoofd/components/members/components/group/BalanceItemCartItemRow.vue';
import { ErrorBox } from '@stamhoofd/components/errors/ErrorBox';
import PriceBreakdownBox from '@stamhoofd/components/views/PriceBreakdownBox.vue';
import RegisterItemRow from '@stamhoofd/components/members/components/group/RegisterItemRow.vue';
import { startCheckout } from '@stamhoofd/components/members/checkout/startCheckout.ts';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useErrors } from '@stamhoofd/components/errors/useErrors';
import { useNavigationActions } from '@stamhoofd/components/types/NavigationActions.ts';
import { useMemberManager } from '@stamhoofd/networking/MemberManager';
import { computed, onActivated, onMounted, ref } from 'vue';
import { usePositionableSheet } from '@stamhoofd/components/tables/usePositionableSheet';
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import BalanceItemCartItemDiscountsSheet from '@stamhoofd/components/members/components/group/BalanceItemCartItemDiscountsSheet.vue';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout);
const cart = computed(() => checkout.value.cart);
const errors = useErrors();
const context = useContext();
const navigate = useNavigationActions();
const owner = useRequestOwner(undefined, {cancelOnDeactivated: true});
const loading = ref(false);

const showDiscountsSeparately = computed(() => checkout.value.showDiscountsSeparately);
const visibleBalanceItems = computed(() => showDiscountsSeparately.value ? cart.value.balanceItems.filter(b => b.price >= 0) : cart.value.balanceItems)
const loadingBalances = computed(() => checkout.value.balanceItems === null)

onMounted(() => {
    checkout.value.updatePrices();

    try {
        errors.errorBox = null;
        checkout.value.validate({});
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
});
onActivated(() => {
    memberManager.updateBalances(checkout.value, {owner}).catch(console.error)
    checkout.value.updatePrices();
});


async function goToCheckout() {
    if (loading.value) {
        return;
    }

    loading.value = true;
    errors.errorBox = null;

    try {
        await startCheckout({
            admin: false,
            checkout: checkout.value,
            context: context.value,
            displayOptions: { action: 'present', modalDisplayStyle: 'popup' },
        }, navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
    finally {
        loading.value = false;
    }
}

const { presentPositionableSheet } = usePositionableSheet();

async function showDiscountSheet(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(BalanceItemCartItemDiscountsSheet, {
                    items: cart.value.balanceItemDiscounts
                }),
            }),
        ],
    }, { minimumHeight: 185, width: 500 });
}


</script>
