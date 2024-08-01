<template>
    <div id="free-contribution-view" class="st-view">
        <STNavigationBar title="Vrije bijdrage" />
        <main>
            <h1>Vrije bijdrage <span class="style-tag">Optioneel</span></h1>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errors.errorBox" />

            <Radio v-model="amountOption" :value="0">
                Geen vrije bijdrage
            </Radio>

            <Radio v-for="(a, index) in amounts" :key="index" v-model="amountOption" :value="a">
                {{ formatPrice(a) }}
            </Radio>
            
            <Radio v-model="amountOption" :value="null">
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
import { ErrorBox, LoadingButton, NavigationActions, PriceInput, Radio, STErrorsDefault, STNavigationBar, STToolbar, useErrors, useNavigationActions } from "@stamhoofd/components";

import { RegisterCheckout } from "@stamhoofd/structures";
import { computed, ref, watchEffect } from "vue";

const props = defineProps<{
    checkout: RegisterCheckout,
    saveHandler: (navigate: NavigationActions) => Promise<void>
}>()


const errors = useErrors();

const organization = computed(() => props.checkout.singleOrganization)
const description = computed(() => organization.value?.meta.recordsConfiguration.freeContribution?.description ?? "")
const amounts = computed(() => (organization.value?.meta.recordsConfiguration.freeContribution?.amounts ?? []).filter(a => a > 0))
const loading = ref(false)
const navigate = useNavigationActions()

const amount = computed({
    get: () => props.checkout.freeContribution,
    set: (value) => props.checkout.freeContribution = value 
});
const amountOption = ref(amounts.value.includes(amount.value) || amount.value === 0 ? amount.value : null)

watchEffect(() => {
    if (amountOption.value !== null) {
        amount.value = amountOption.value
    }
})

async function goNext() {
    try {
        await props.saveHandler(navigate)
    } catch (e) {
        errors.errorBox = new ErrorBox(e)
    }
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
