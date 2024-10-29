<template>
    <LoadingView v-if="loading" />
    <div v-else class="st-view ticket-view">
        <STNavigationBar v-if="!$isMobile" :large="!true" :sticky="false">
            <template #left>
                <OrganizationLogo :organization="organization" />
            </template>
        </STNavigationBar>
    </div>
</template>

<script lang="ts" setup>
import { ArrayDecoder, Decoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { DetailedTicketView, LoadingView, OrganizationLogo, STNavigationBar, Toast, useIsMobile } from '@stamhoofd/components';
import { TicketPublic } from '@stamhoofd/structures';
import { computed, Ref, ref } from 'vue';
import { useWebshopManager } from '../../composables/useWebshopManager';

const props = defineProps<{
    secret: string;
}>();

const webshopManager = useWebshopManager();
const present = usePresent();
const isMobile = useIsMobile();

const loading = ref(true);
const tickets = ref<TicketPublic[]>([]) as Ref<TicketPublic[]>;

const organization = computed(() => webshopManager.organization);
const webshop = computed(() => webshopManager.webshop);

async function downloadTickets() {
    loading.value = true;

    try {
        const response = await webshopManager.server.request({
            method: 'GET',
            path: '/webshop/' + webshopManager.webshop.id + '/tickets',
            query: {
                // Required because we don't need to repeat item information (network + database impact)
                secret: props.secret,
            },
            decoder: new ArrayDecoder(TicketPublic as Decoder<TicketPublic>),
        });
        tickets.value = response.data;
        openTicket();
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    loading.value = false;
}

function openTicket() {
    present({
        components: [
            new ComponentWithProperties(NavigationController, {
                root: new ComponentWithProperties(DetailedTicketView, {
                    ticket: tickets.value[0],
                    webshop: webshop.value,
                    organization: organization.value,
                    allowDismiss: false,
                    logo: !!isMobile,
                }),
            }),
        ],
        modalDisplayStyle: 'sheet',
        animated: false,
    }).catch(console.error);
}

function created() {
    downloadTickets().catch(console.error);
}

created();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use "@stamhoofd/scss/base/text-styles.scss" as *;

.ticket-view {
    --box-width: 400px;
}
</style>
