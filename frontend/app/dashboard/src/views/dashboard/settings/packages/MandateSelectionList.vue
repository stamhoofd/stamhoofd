<template>
    <div>
        <Spinner v-if="loading" />
        <STList v-else class="payment-selection-list">
            <STListItem v-for="mandate in mandates" :key="mandate.id" :selectable="allowSelection" :element-name="allowSelection ? 'label' : 'div'" class="right-stack left-center">
                <template #left>
                    <Radio v-if="allowSelection" v-model="selectedMandate" name="choose-mandate" :value="mandate.id" />
                    <figure v-else class="style-image-with-icon" :class="{gray: !mandate.isDefault}">
                        <figure v-if="mandate.method === 'creditcard'">
                            <img v-if="mandate.details.cardLabel === 'Mastercard'" src="@stamhoofd/assets/images/partners/icons/mastercard.svg">
                            <img v-else-if="mandate.details.cardLabel === 'Visa'" src="@stamhoofd/assets/images/partners/icons/visa.svg">
                            <span v-else class="icon card" />
                        </figure>
                        <figure v-else>
                            <span class="icon bank" />
                        </figure>
                        <aside>
                            <span v-if="mandate.isDefault" v-tooltip="'Standaard betaalkaart'" class="icon success small primary" />
                            <span v-if="mandate.status === 'invalid'" v-tooltip="'Ongeldig'" class="icon error red small" />
                            <span v-if="mandate.status === 'pending'" v-tooltip="'In afwachting van verificatie'" class="icon clock small gray" />
                        </aside>
                    </figure>
                </template>

                <p v-if="mandate.isDefault" class="style-title-prefix-list">
                    Huidige betaalmethode
                </p>

                <h3 class="style-title-list">
                    {{ getName(mandate) }}
                </h3>
                <p v-if="getDescription(mandate)" class="style-description-small">
                    {{ getDescription(mandate) }}
                </p>

                <template v-if="allowDelete" #right>
                    <LoadingButton :loading="isDeleting(mandate)">
                        <button v-tooltip="'Ontkoppel deze bankrekening'" type="button" class="button icon trash" @click.stop="deleteMandate(mandate)" />
                    </LoadingButton>
                </template>
            </STListItem>

            <STListItem v-if="!required && allowSelection" :selectable="true" element-name="label" class="right-stack left-center">
                <template #left>
                    <Radio v-model="selectedMandate" name="choose-payment-mandate" :value="null" />
                </template>

                <h3 class="style-title-list">
                    Nieuwe betaalkaart koppelen
                </h3>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts" setup>
import { Decoder } from '@simonbackx/simple-encoding';
import { CenteredMessage, LoadingButton, Radio, Spinner, STList, STListItem, Toast, useContext } from '@stamhoofd/components';
import { Organization, OrganizationPaymentMandate, STBillingStatus } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import { useOrganizationManager, useRequestOwner } from '@stamhoofd/networking';
import { computed, onMounted, ref } from 'vue';

const props = withDefaults(defineProps<{
    organization: Organization;
    defaultStatus?: STBillingStatus | null;
    required?: boolean;
    allowSelection?: boolean;
    allowDelete?: boolean;
}>(), {
    defaultStatus: null,
    required: true,
    allowSelection: true,
    allowDelete: true,
});

const model = defineModel<string | null>({ default: null });
const context = useContext();
const loading = ref(false);
const status = ref<STBillingStatus | null>(null);
const deletingMandates = ref([] as string[]);
const owner = useRequestOwner();
const organizationManager = useOrganizationManager();

onMounted(() => {
    loadMandates().catch(console.error);
});

const mandates = computed(() => {
    const base = props.defaultStatus?.mandates ?? status.value?.mandates ?? [];
    base.sort((a, b) => {
        if (a.status === 'valid' && b.status !== 'valid') return -1;
        if (a.status !== 'valid' && b.status === 'valid') return 1;
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
    });
    const found = new Set<string>();

    const cleaned: OrganizationPaymentMandate[] = [];

    for (const mandate of base) {
        const consumerAccount = mandate.details.consumerAccount;
        if (found.has(consumerAccount || '')) {
            continue; // Skip duplicates
        }
        found.add(consumerAccount || '');
        cleaned.push(mandate);
    }

    // Todo: remove duplicates, preferring the first created mandate that is valid

    if (props.allowSelection) {
        return cleaned.filter(b => b.status === 'valid');
    }

    return cleaned;
});

const selectedMandate = computed({ get: () => {
    return model.value;
},
set: (value) => {
    model.value = value;
} });

async function loadMandates() {
    if (props.defaultStatus) {
        return;
    }
    loading.value = true;

    try {
        status.value = await organizationManager.value.loadBillingStatus({
            owner,
        });
        await Promise.resolve();

        selectedMandate.value = selectedMandate.value || mandates.value[0]?.id || null;
    }
    catch (e) {
        Toast.fromError(e).show();
    }
    finally {
        loading.value = false;
    }
}

function isDeleting(mandate: OrganizationPaymentMandate): boolean {
    return deletingMandates.value.includes(mandate.id);
}

async function deleteMandate(mandate: OrganizationPaymentMandate) {
    if (isDeleting(mandate)) {
        return;
    }

    if (!await CenteredMessage.confirm('Wil je deze betaalmethode (' + getName(mandate) + ') verwijderen?', 'Ja, verwijderen', 'Je kan dit niet ongedaan maken', undefined, true)) {
        return;
    }

    deletingMandates.value.push(mandate.id);

    try {
        const result = await context.value.authenticatedServer.request({
            method: 'DELETE',
            path: '/billing/mandate/' + mandate.id,
            decoder: STBillingStatus as Decoder<STBillingStatus>,
            owner: owner,
            shouldRetry: false,
        });

        if (status.value) {
            status.value.set(result.data);
        }
        else {
            if (props.defaultStatus) {
                props.defaultStatus.set(result.data);
            }
        }
    }
    catch (e) {
        Toast.fromError(e).show();
    }

    // Remove
    deletingMandates.value = deletingMandates.value.filter(id => id !== mandate.id);
}

function getName(mandate: OrganizationPaymentMandate): string {
    if (!mandate.details.consumerAccount) {
        return 'Onbekende betaalmethode';
    }

    switch (mandate.method) {
        case 'creditcard': {
            let suffix = '';
            if (mandate.details.cardExpiryDate) {
                const d = new Date(mandate.details.cardExpiryDate);
                suffix = ` (${d.getMonth() + 1}/${d.getFullYear()})`;
            }
            return '•••• ' + mandate.details.consumerAccount + suffix;
        }
        case 'directdebit': return Formatter.iban(mandate.details.consumerAccount);
    }

    return Formatter.iban(mandate.details.consumerAccount);
}

function getDescription(mandate: OrganizationPaymentMandate): string {
    switch (mandate.method) {
        case 'creditcard': return mandate.details.consumerName || '';
        case 'directdebit': return mandate.details.consumerName || '';
    }
    return '';
}
</script>

<style lang="scss">
.payment-selection-list {
    .payment-method-logo {
        max-height: 30px;

        &.bancontact {
            max-height: 38px;
            margin: -4px 0 !important; // Fix white borders in bancontact logo
        }
    }

    .payment-app-logo {
        height: 28px;
        width: 28px;
    }

    .payment-app-banner {
        display: flex;
        flex-direction: row;
        padding-top: 10px;

        > * {
            margin-right: 5px
        }
    }
}

</style>
