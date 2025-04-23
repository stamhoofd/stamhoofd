<template>
    <div id="free-contribution-view" class="st-view">
        <STNavigationBar :title="$t(`Vrije bijdrage`)" />
        <main>
            <h1>{{ $t('16ca0372-9c8f-49f0-938d-aee012e59f8c') }} <span class="style-tag">{{ $t('9e0461d2-7439-4588-837c-750de6946287') }}</span></h1>
            <p v-if="description" class="style-description pre-wrap" v-text="description" />

            <STErrorsDefault :error-box="errors.errorBox" />

            <Radio v-model="amountOption" :value="0">
                {{ $t('925f51be-8d11-4d0d-b07e-839e0222547f') }}
            </Radio>

            <Radio v-for="(a, index) in amounts" :key="index" v-model="amountOption" :value="a">
                {{ formatPrice(a) }}
            </Radio>

            <Radio v-model="amountOption" :value="null">
                {{ amounts.length === 0 ? 'Bedrag kiezen' : 'Ander bedrag kiezen' }}
            </Radio>

            <div v-if="amountOption === null" class="textarea-container">
                <PriceInput v-model="amount" :placeholder="$t(`44e56381-34ef-49e6-818f-f7991c570866`)" />
            </div>

            <p v-if="amount >= 5000" class="info-box">
                {{ $t('d83e6c6e-8a72-4339-8da8-4530a36c55f3') }}
            </p>

            <p v-else-if="amount >= 3000" class="info-box">
                {{ $t('36640c0d-7fdd-4dae-a827-dc0a220bf53e') }}
            </p>

            <p v-else-if="amount >= 1500" class="info-box">
                {{ $t('77c43ee8-46bb-43a7-b175-bd6fa9a64ae6') }}
            </p>

            <p v-else-if="amount > 0" class="info-box">
                {{ $t('435bede9-74ff-49c9-b62c-864a60767c7a') }}
            </p>
        </main>

        <STToolbar>
            <template #left>
                <span>{{ $t('3cf6b16f-f5b7-4291-8446-627210a64900') }} {{ formatPrice(checkout.totalPrice) }}</span>
            </template>
            <template #right>
                <LoadingButton :loading="loading">
                    <button class="button primary" type="button" @click="goNext">
                        <span>{{ $t('c72a9ab2-98a0-4176-ba9b-86fe009fa755') }}</span>
                        <span class="icon arrow-right" />
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ErrorBox, LoadingButton, NavigationActions, PriceInput, Radio, STErrorsDefault, STNavigationBar, STToolbar, useErrors, useNavigationActions } from '@stamhoofd/components';

import { RegisterCheckout } from '@stamhoofd/structures';
import { computed, ref, watchEffect } from 'vue';

const props = defineProps<{
    checkout: RegisterCheckout;
    saveHandler: (navigate: NavigationActions) => Promise<void>;
}>();

const errors = useErrors();

const organization = computed(() => props.checkout.singleOrganization);
const description = computed(() => organization.value?.meta.recordsConfiguration.freeContribution?.description ?? '');
const amounts = computed(() => (organization.value?.meta.recordsConfiguration.freeContribution?.amounts ?? []).filter(a => a > 0));
const loading = ref(false);
const navigate = useNavigationActions();

const amount = computed({
    get: () => props.checkout.freeContribution,
    set: value => props.checkout.freeContribution = value,
});
const amountOption = ref(amounts.value.includes(amount.value) || amount.value === 0 ? amount.value : null);

watchEffect(() => {
    if (amountOption.value !== null) {
        amount.value = amountOption.value;
    }
});

async function goNext() {
    try {
        await props.saveHandler(navigate);
    }
    catch (e) {
        errors.errorBox = new ErrorBox(e);
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
