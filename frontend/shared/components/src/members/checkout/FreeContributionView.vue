<template>
    <div id="free-contribution-view" class="st-view">
        <STNavigationBar :title="$t(`Vrije bijdrage`)"/>
        <main>
            <h1>{{ $t('40157aa3-6407-4429-a14a-fb8773df802b') }} <span class="style-tag">{{ $t('e64a0d25-fe5a-4c87-a087-97ad30b2b12b') }}</span></h1>
            <p v-if="description" class="style-description pre-wrap" v-text="description"/>

            <STErrorsDefault :error-box="errors.errorBox"/>

            <Radio v-model="amountOption" :value="0">
                {{ $t('0d06a945-6d2d-4b67-8390-9bdf7688d5cf') }}
            </Radio>

            <Radio v-for="(a, index) in amounts" :key="index" v-model="amountOption" :value="a">
                {{ formatPrice(a) }}
            </Radio>
            
            <Radio v-model="amountOption" :value="null">
                {{ amounts.length === 0 ? 'Bedrag kiezen' : 'Ander bedrag kiezen' }}
            </Radio>

            <div v-if="amountOption === null" class="textarea-container">
                <PriceInput v-model="amount" :placeholder="$t(`b159f8f9-b298-4d55-afa1-e7208b5b6912`)"/>
            </div>

            <p v-if="amount >= 5000" class="info-box">
                {{ $t('662521ad-bdf9-4d4f-b4e2-2297f780d76d') }}
            </p>

            <p v-else-if="amount >= 3000" class="info-box">
                {{ $t('0d4f6578-2e2c-42a8-a96a-141837c7cc9b') }}
            </p>

            <p v-else-if="amount >= 1500" class="info-box">
                {{ $t('34060424-a852-4351-901d-b971a4299b4b') }}
            </p>     

            <p v-else-if="amount > 0" class="info-box">
                {{ $t('5f3e2ef0-7264-42fa-8b47-942c789f56b9') }}
            </p>              
        </main>

        <STToolbar>
            <template #left>
                <span>{{ $t('6cbde4da-3770-4726-8ea4-9a53b785a66e') }} {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span>{{ $t('458858f8-0a9a-4a3d-b4f4-a4421a48114e') }}</span>
                        <span class="icon arrow-right"/>
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
