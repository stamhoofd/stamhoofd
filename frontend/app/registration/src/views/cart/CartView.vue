<template>
    <section class="st-view">
        <STNavigationBar title="Winkelmandje" />
        <main class="center">
            <h1>
                Winkelmandje
            </h1>

            <p v-if="cart.price">
                Voeg alle inschrijvingen toe aan het mandje en reken in één keer af.
            </p>
            <p v-else>
                Voeg alle inschrijvingen toe aan het mandje en bevestig ze.
            </p>
            
            <STErrorsDefault :error-box="errors.errorBox" />

            <p v-if="cart.isEmpty" class="info-box">
                Jouw mandje is leeg. Schrijf een lid in via het tabblad 'Start'.
            </p>

            <template v-else>
                <STList>
                    <RegisterItemRow v-for="item in cart.items" :key="item.id" class="right-stack" :item="item" />
                </STList>
                <PriceBreakdownBox :price-breakdown="checkout.priceBreakown" />

                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goToCheckout">
                        <span v-if="checkout.totalPrice">Afrekenen</span>
                        <span v-else>Bevestigen</span>

                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
import { ErrorBox, PriceBreakdownBox, RegisterItemRow, startCheckout, useContext, useErrors, useNavigationActions } from '@stamhoofd/components';
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
