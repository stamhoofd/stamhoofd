<template>
    <div class="st-view background">
        <STNavigationBar :title="pack.meta.name" :dismiss="canDismiss" :pop="canPop" />

        <main>
            <h1>
                {{ pack.meta.name }}
            </h1>

            <p>
                Alle bedragen zijn excl. BTW, tenzij anders vermeld.
            </p>

            <STErrorsDefault :error-box="errors.errorBox" />

            <STList v-if="pack.meta.pricingType === 'PerMember'">
                <STListItem>
                    Aantal leden

                    <template #right>
                        {{ pack.meta.paidAmount }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.meta.unitPrice">
                    Prijs

                    <template #right>
                        {{ Formatter.price(pack.meta.unitPrice) }} / jaar / lid
                    </template>
                </STListItem>

                <STListItem>
                    Minimum bedrag per jaar

                    <template #right>
                        {{ Formatter.price(pack.meta.minimumAmount * pack.meta.unitPrice) }}
                        ({{ pack.meta.minimumAmount }} leden)
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template #right>
                        {{ Formatter.startDate(pack.meta.startDate) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template #right>
                        {{ Formatter.endDate(pack.validUntil) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.allowRenew && !isValid">
                    Verlengbaar tot

                    <template #right>
                        {{ Formatter.endDate(pack.removeAt) }}
                    </template>
                </STListItem>
            </STList>

            <STList v-else-if="pack.meta.pricingType === 'PerYear'">
                <STListItem>
                    Prijs

                    <template #right>
                        {{ Formatter.price(pack.meta.unitPrice) }} / jaar
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template #right>
                        {{ Formatter.startDate(pack.meta.startDate) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template #right>
                        {{ Formatter.endDate(pack.validUntil) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.allowRenew && !isValid">
                    Verlengbaar tot

                    <template #right>
                        {{ Formatter.endDate(pack.removeAt) }}
                    </template>
                </STListItem>
            </STList>

            <STList v-else-if="pack.meta.pricingType === 'Fixed'">
                <STListItem v-if="pack.meta.unitPrice">
                    Prijs

                    <template #right>
                        {{ Formatter.price(pack.meta.unitPrice) }}
                    </template>
                </STListItem>

                <STListItem>
                    Vanaf

                    <template #right>
                        {{ Formatter.startDate(pack.meta.startDate) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.validUntil">
                    Geldig tot

                    <template #right>
                        {{ Formatter.endDate(pack.validUntil) }}
                    </template>
                </STListItem>

                <STListItem v-if="pack.removeAt && pack.meta.allowRenew && !isValid">
                    Verlengbaar tot

                    <template #right>
                        {{ Formatter.endDate(pack.removeAt) }}
                    </template>
                </STListItem>
            </STList>
        </main>

        <STToolbar v-if="pack.meta.canDeactivate || pack.shouldHintRenew()">
            <template #right>
                <LoadingButton v-if="pack.meta.canDeactivate" :loading="deactivating">
                    <button class="button secundary" type="button" @click="deactivate">
                        Stopzetten
                    </button>
                </LoadingButton>

                <LoadingButton v-if="pack.shouldHintRenew()" :loading="loading">
                    <button class="button primary" type="button" @click="extend">
                        Verlengen
                    </button>
                </LoadingButton>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts" setup>
import { ComponentWithProperties, useCanDismiss, useCanPop, usePop, useShow } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, LoadingButton, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast, useContext, useErrors } from '@stamhoofd/components';
import { STPackage } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import PackageConfirmView from './PackageConfirmView.vue';

const props = defineProps<{ pack: STPackage }>();
const context = useContext();
const show = useShow();
const canPop = useCanPop();
const canDismiss = useCanDismiss();
const pop = usePop();
const errors = useErrors();
const loading = ref(false);
const deactivating = ref(false);

function extend() {
    show(new ComponentWithProperties(PackageConfirmView, {
        renewPackages: [props.pack],
    })).catch(console.error);
}

async function deactivate() {
    if (deactivating.value) {
        return;
    }

    if (!await CenteredMessage.confirm('Ben je zeker dat je dit wilt stopzetten?', 'Meteen stopzetten')) {
        return;
    }
    deactivating.value = true;

    try {
        await context.value.authenticatedServer.request({
            method: 'POST',
            path: '/billing/deactivate-package/' + props.pack.id,
        });
        // todo?
        await context.value.fetchOrganization();
        pop({ force: true })?.catch(console.error);
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    deactivating.value = false;
}

const isValid = computed(() => props.pack.validUntil === null || props.pack.validUntil > new Date());

function shouldNavigateAway() {
    // TODO
    if (loading.value) {
        return false;
    }
    return true;
}

defineExpose({
    shouldNavigateAway,
});
</script>
