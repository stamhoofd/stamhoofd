<template>
    <div id="free-contribution-view" class="st-view">
        <STNavigationBar title="Vrije bijdrage" />
        <main>
            <h1>Vrije bijdrage <span class="style-tag">Optioneel</span></h1>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errors.errorBox" />

            <Radio v-model="amountOption" :value="0" name="contributionRadio">
                Geen vrije bijdrage
            </Radio>

            <Radio v-for="(a, index) in amounts" :key="index" v-model="amountOption" :value="a" name="contributionRadio">
                {{ formatPrice(a) }}
            </Radio>
            
            <Radio v-model="amountOption" :value="null" name="contributionRadio">
                {{ amounts.length == 0 ? 'Bedrag kiezen' : 'Ander bedrag kiezen' }}
            </Radio>

            <div v-if="amountOption === null" class="textarea-container">
                <PriceInput v-model="amount" placeholder="Jouw bijdrage" />
            </div>

            <p v-if="amount >= 5000" class="info-box">
                Heel erg bedankt voor de gulle bijdrage! 😍❤️
            </p>

            <p v-else-if="amount >= 3000" class="info-box">
                Heel erg bedankt voor de gulle bijdrage! 😍
            </p>

            <p v-else-if="amount >= 1500" class="info-box">
                Bedankt voor de warme bijdrage! 🙌
            </p>     

            <p v-else-if="amount > 0" class="info-box">
                Bedankt voor de bijdrage 😊
            </p>              
        </main>

        <STToolbar>
            <template #left>
                <span>Totaal: {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span>Doorgaan</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { LoadingButton, PriceInput, Radio, STErrorsDefault, STNavigationBar, STToolbar, useErrors } from "@stamhoofd/components";

import { computed, ref, watchEffect } from "vue";
import { useMemberManager } from "../../getRootView";
import { ComponentWithProperties, useShow } from "@simonbackx/vue-app-navigation";
import PaymentSelectionView from "./PaymentSelectionView.vue";

const memberManager = useMemberManager();
const errors = useErrors();
const show = useShow();

const checkout = computed(() => memberManager.family.checkout)
const organization = computed(() => checkout.value.singleOrganization)
const description = computed(() => organization.value?.meta.recordsConfiguration.freeContribution?.description ?? "")
const amounts = computed(() => (organization.value?.meta.recordsConfiguration.freeContribution?.amounts ?? []).filter(a => a > 0))
const loading = ref(false)

const amount = computed({
    get: () => checkout.value.freeContribution,
    set: (value) => checkout.value.freeContribution = value 
});
const amountOption = ref(amounts.value.includes(amount.value) || amount.value === 0 ? amount.value : null)
watchEffect(() => {
    if (amountOption.value !== null) {
        amount.value = amountOption.value
    }
})

async function goNext() {
    await show(new ComponentWithProperties(PaymentSelectionView, {}))
}

</script>

<style lang="scss">
#free-contribution-view {
    .style-description {
        padding-bottom: 20px;
    }

    .textarea-container {
        padding-bottom: 20px;
        padding-left: 35px;
        max-width: 200px;

        @media (max-width: 450px) {
            padding-left: 0;
        }
    }
}
</style>
