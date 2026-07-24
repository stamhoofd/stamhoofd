<template>
    <LoadingViewTransition>
        <div v-if="status" id="referral-view" class="st-view background">
            <STNavigationBar :title="$t('%1d0')" />

            <main>
                <h1 v-if="!status.invoiceValue">
                    {{ $t('%1bn', {value: formatPrice(status.value)}) }}
                </h1>
                <h1 v-else>
                    {{ $t('%1Wj', {value: formatPrice(status.value)}) }}
                </h1>

                <p v-if="!status.invoiceValue">
                    {{ $t('%1Uk') }}
                </p>

                <hr>
                <h2>{{ $t('%1aC') }}</h2>

                <input v-copyable="href" v-tooltip="$t('%Ip')" class="input" :value="href" readonly>

                <p class="info-box">
                    {{ $t('%1XE') }}
                </p>

                <STList>
                    <STListItem :selectable="true" @click="openFacebookShare">
                        <h2 class="style-title-list">
                            {{ $t('%1ZZ') }}
                        </h2>
                        <template #left>
                            <span class="icon share" />
                        </template>
                    </STListItem>
                    <STListItem v-if="canShare" :selectable="true" @click="share">
                        <h2 class="style-title-list">
                            {{ $t('%1Zy') }}
                        </h2>
                        <template #left>
                            <span class="icon share" />
                        </template>
                    </STListItem>
                    <STListItem v-if="!isNative" :selectable="true" @click="downloadQR">
                        <h2 class="style-title-list">
                            {{ $t('%1Vl') }}
                        </h2>
                        <p class="style-description-small">
                            {{ $t('%1YX') }}
                        </p>
                        <template #left>
                            <span class="icon qr-code" />
                        </template>
                    </STListItem>
                </STList>

                <template v-if="!status.invoiceValue">
                    <hr>
                    <h2>{{ $t('%1V0') }}</h2>
                    <p>{{ $t('%1aI') }}</p>

                    <STList>
                        <STListItem v-for="n in 9" :key="n">
                            {{ $t('%1dT', {n}) }}

                            <template #right>
                                <span class="style-tag large">€ {{ n * 10 }}</span>
                            </template>
                            <template #left>
                                <span v-if="referredCount >= n" class="icon star small yellow" />
                                <span v-else class="icon star-line small light-gray" />
                            </template>
                        </STListItem>
                        <STListItem>
                            {{ $t('%1a0') }}

                            <template #right>
                                <span class="style-tag large">€ 100</span>
                            </template>
                            <template #left>
                                <span v-if="referredCount >= 10" class="icon star small yellow" />
                                <span v-else class="icon star-line small light-gray" />
                            </template>
                        </STListItem>
                    </STList>
                </template>

                <hr>
                <h2>{{ $t('%1bZ') }}</h2>
                <p>{{ $t('%1Vc') }}</p>

                <STList v-if="status.usedCodes.length > 0">
                    <STListItem v-for="used in status.usedCodes" :key="used.id" class="right-description">
                        <template #left>
                            <span v-if="used.creditValue !== null" class="icon success green" />
                            <span v-else class="icon clock gray" />
                        </template>
                        <h2 class="style-title-list">
                            {{ used.organizationName }}
                        </h2>
                        <p v-if="used.creditValue" class="style-description">
                            {{ $t('%1cg') }}
                        </p>
                        <p v-else-if="used.creditValue !== null && status.invoiceValue" class="style-description">
                            {{ $t('%1aa') }}
                        </p>
                        <p v-else-if="!status.invoiceValue" class="style-description">
                            {{ $t('%1cR', {date: formatDate(used.createdAt)}) }}
                        </p>
                        <p v-else class="style-description">
                            {{ $t('%1b7', {date: formatDate(used.createdAt)}) }}
                        </p>
                        <template #right>
                            <span v-if="used.creditValue" class="style-tag large success">{{ formatPrice(used.creditValue) }}</span>
                        </template>
                    </STListItem>
                </STList>

                <p v-else class="info-box">
                    {{ $t('%1Yx') }}
                </p>

                <hr v-if="!status.invoiceValue">
                <p v-if="!status.invoiceValue" class="style-description-small">
                    {{ $t('%1c9') }}
                </p>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script lang="ts" setup>
import type { Decoder } from '@simonbackx/simple-encoding';
import { Toast } from '@stamhoofd/components/overlays/Toast';
import LoadingViewTransition from '@stamhoofd/components/containers/LoadingViewTransition.vue';
import { useContext } from '@stamhoofd/components/hooks/useContext';
import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { LocalizedDomains } from '@stamhoofd/frontend-i18n/LocalizedDomains';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { RegisterCodeStatus } from '@stamhoofd/structures';
import { Sorter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';

const status = ref<RegisterCodeStatus | null>(null);
const context = useContext();
const owner = useRequestOwner();
const organization = useRequiredOrganization();

const isNative = AppManager.shared.isNative;
const canShare = !!navigator.share;

const referralText = $t('%ZgE');

const href = computed(() => {
    return 'https://' + STAMHOOFD.domains.dashboard + '/aansluiten?code=' + encodeURIComponent(status.value?.code ?? '') + '&org=' + encodeURIComponent(organization.value.name);
});

const referredCount = computed(() => {
    return status.value?.usedCodes.reduce((c, code) => c + (code.creditValue !== null ? 1 : 0), 0) ?? 0;
});

function share() {
    navigator.share({
        text: referralText,
        url: href.value,
    }).catch(e => console.error(e));
}

async function downloadQR() {
    try {
        const QRCode = (await import(/* webpackChunkName: "QRCode" */ 'qrcode')).default;
        const url = await QRCode.toDataURL(href.value, { scale: 10 });
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'qr-code.png';
        anchor.click();
    } catch (e) {
        console.error(e);
    }
}

async function loadCode() {
    try {
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/billing/register-code',
            decoder: RegisterCodeStatus as Decoder<RegisterCodeStatus>,
            owner,
        });
        response.data.usedCodes.sort((a, b) => Sorter.byDateValue(b.createdAt, a.createdAt));
        status.value = response.data;
    } catch (e) {
        console.error(e);
        Toast.fromError(e).show();
    }
}

function openFacebookShare() {
    window.open('https://www.facebook.com/sharer/sharer.php?u=https://' + LocalizedDomains.marketing + '&quote=' + encodeURIComponent(referralText), 'pop', 'width=600, height=400, scrollbars=no');
}

loadCode().catch(console.error);
</script>
