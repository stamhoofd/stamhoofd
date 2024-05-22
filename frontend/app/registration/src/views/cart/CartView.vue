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
            </template>
        </main>
    </section>
</template>

<script setup lang="ts">
import { PriceBreakdownBox, useOrganization } from '@stamhoofd/components';
import { RegisterItem } from '@stamhoofd/structures';
import { computed, onActivated, onMounted } from 'vue';
import { useMemberManager } from '../../getRootView';

const memberManager = useMemberManager();
const checkout = computed(() => memberManager.family.checkout)
const cart = computed(() => checkout.value.cart)
const organization = useOrganization()

onMounted(() => {
    checkout.value.updatePrices()
})
onActivated(() => {
    checkout.value.updatePrices()
})

function deleteItem(item: RegisterItem) {
    cart.value.remove(item)
}

</script>
