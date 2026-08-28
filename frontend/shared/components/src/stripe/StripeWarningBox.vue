<template>
    <p v-for="(stripeWarning, index) of stripeWarnings" :key="'stripe-warning-'+index" :class="stripeWarning.type + '-box'">
        {{ stripeWarning.text }}

        <a :href="$domains.getDocs('documenten-stripe-afgekeurd')" target="_blank" class="button text">
            {{ $t('%19t') }}
        </a>
    </p>
</template>

<script setup lang="ts">
import { useAuth } from '#hooks/useAuth.ts';
import { useContext } from '#hooks/useContext.ts';
import { ArrayDecoder } from '@simonbackx/simple-encoding';
import type { Decoder } from '@simonbackx/simple-encoding';
import { useRequestOwner } from '@stamhoofd/networking/hooks/useRequestOwner';
import { AccessRight, StripeAccount } from '@stamhoofd/structures';
import { computed, ref } from 'vue';
import type { Ref } from 'vue';

const context = useContext();
const owner = useRequestOwner();
const auth = useAuth();

const stripeAccounts = ref([]) as Ref<StripeAccount[]>;
const loadingStripeAccounts = ref(false);
const stripeWarnings = computed(() => {
    return stripeAccounts.value.flatMap(a => a.warning ? [a.warning] : []);
});

loadStripeAccounts(null).catch(console.error);

async function loadStripeAccounts(recheckStripeAccount: string | null) {
    if (!auth.hasFullAccess()) return;

    try {
        loadingStripeAccounts.value = true;
        if (recheckStripeAccount) {
            try {
                await context.value.authenticatedServer.request({
                    method: 'POST',
                    path: '/stripe/accounts/' + encodeURIComponent(recheckStripeAccount),
                    decoder: StripeAccount as Decoder<StripeAccount>,
                    owner,
                });
            } catch (e) {
                console.error(e);
            }
        }
        const response = await context.value.authenticatedServer.request({
            method: 'GET',
            path: '/stripe/accounts',
            decoder: new ArrayDecoder(StripeAccount as Decoder<StripeAccount>),
            owner,
        });
        stripeAccounts.value = response.data;

        if (!recheckStripeAccount) {
            for (const account of stripeAccounts.value) {
                try {
                    const response = await context.value.authenticatedServer.request({
                        method: 'POST',
                        path: '/stripe/accounts/' + encodeURIComponent(account.id),
                        decoder: StripeAccount as Decoder<StripeAccount>,
                        owner,
                    });
                    account.deepSet(response.data);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    loadingStripeAccounts.value = false;
}
</script>
