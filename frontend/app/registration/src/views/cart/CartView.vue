<template>
    <section class="st-view">
        <STNavigationBar :title="$t(`Winkelmandje`)"/>
        <main class="center">
            <h1>
                {{ $t('608dd4a9-dbba-4c2b-818b-5e32296e7289') }}
            </h1>

            <p v-if="cart.price">
                {{ $t('40334e5d-628c-4405-9559-38471aabff07') }}
            </p>
            <p v-else>
                {{ $t('f4a456cd-75a8-4c99-a72f-3f6a68f8b1ca') }}
            </p>
            
            <STErrorsDefault :error-box="errors.errorBox"/>

            <p v-if="cart.isEmpty" class="info-box">
                {{ $t("c0a00b6b-518d-4f45-9c6c-34ca3c6ac5ac") }}
            </p>

            <template v-else>
                <STList>
                    <RegisterItemRow v-for="item in cart.items" :key="item.id" class="right-stack" :item="item"/>
                    <BalanceItemCartItemRow v-for="item in cart.balanceItems" :key="item.id" class="right-stack" :item="item" :checkout="checkout"/>
                </STList>
                <PriceBreakdownBox :price-breakdown="checkout.priceBreakown"/>

                <p class="style-button-bar right-align">
                    <LoadingButton :loading="loading">
                        <button class="button primary" type="button" @click="goToCheckout">
                            <span v-if="checkout.totalPrice">{{ $t('d5e1da37-d000-4e17-a8b3-7f924d8e42e6') }}</span>
                            <span v-else>{{ $t('da58ee7b-f99e-448b-9acc-37f7df4f9f26') }}</span>

                            <span class="icon arrow-right"/>
                        </button>
                    </LoadingButton>
                </p>
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
import { BalanceItemCartItemRow, ErrorBox, PriceBreakdownBox, RegisterItemRow, startCheckout, useContext, useErrors, useNavigationActions } from '@stamhoofd/components';
import { useMemberManager } from '@stamhoofd/networking';
import { computed, onActivated, onMounted, ref } from 'vue';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout)
const cart = computed(() => checkout.value.cart)
const errors = useErrors()
const context = useContext()
const navigate = useNavigationActions();

const loading = ref(false)

onMounted(() => {
    checkout.value.updatePrices()

    try {
        errors.errorBox = null
        checkout.value.validate({})
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
})
onActivated(() => {
    checkout.value.updatePrices()
})

async function goToCheckout() {
    if (loading.value) {
        return
    }

    loading.value = true
    errors.errorBox = null

    try {
        await startCheckout({
            admin: false,
            checkout: checkout.value,
            context: context.value,
            displayOptions: {action: 'present', modalDisplayStyle: 'popup'}
        }, navigate)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        loading.value = false
    }
}

</script>
