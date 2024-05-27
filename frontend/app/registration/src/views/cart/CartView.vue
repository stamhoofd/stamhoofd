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

            <p v-if="cart.isEmpty" class="info-box">
                Jouw mandje is leeg. Schrijf een lid in via het tabblad 'Start'.
            </p>

            <template v-else>
                <STList>
                    <STListItem v-for="item in cart.items" :key="item.id" class="right-stack">
                        <h3 class="style-title-list">
                            <span>{{ item.member.patchedMember.name }}</span>
                        </h3>
                        <p v-if="!organization" class="style-description">
                            {{ item.organization.name }}
                        </p>
                        <p class="style-description">
                            {{ item.waitingList ? "Wachtlijst van " : "Inschrijven voor " }}{{ item.group.settings.name }}
                        </p>

                        <template #right>
                            <p v-if="item.calculatedPrice" class="price">
                                {{ formatPrice(item.calculatedPrice) }}
                            </p>
                            <div @click.stop>
                                <button class="button icon trash gray" type="button" @click="deleteItem(item)" />
                            </div>
                        </template>
                    </STListItem>
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
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { ErrorBox, PriceBreakdownBox, useErrors, useOrganization } from '@stamhoofd/components';
import { RegisterItem } from '@stamhoofd/structures';
import { DefineComponent, computed, onActivated, onMounted, ref } from 'vue';
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout)
const cart = computed(() => checkout.value.cart)
const organization = useOrganization()
const errors = useErrors()
const present = usePresent();

const loading = ref(false)

onMounted(() => {
    checkout.value.updatePrices()
})
onActivated(() => {
    checkout.value.updatePrices()
})

function deleteItem(item: RegisterItem) {
    cart.value.remove(item)
}

async function goToCheckout() {
    if (loading.value) {
        return
    }

    loading.value = true
    errors.errorBox = null

    try {
        checkout.value.validate({})

        // Go to the next step
        const organization = checkout.value.singleOrganization

        let component: unknown
        if(organization && organization.meta.recordsConfiguration.freeContribution !== null) {
            // Go to financial view
            component = (await import('./FreeContributionView.vue')).default;
        } else {
            // Go to financial view
            component = (await import('./PaymentSelectionView.vue')).default;
        }

        await present({
            components: [
                new ComponentWithProperties(component, {}),
            ],
            modalDisplayStyle: "popup"
        });
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    } finally {
        loading.value = false
    }
}

</script>
