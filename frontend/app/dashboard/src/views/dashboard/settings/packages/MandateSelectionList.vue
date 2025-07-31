<template>
    <div>
        <Spinner v-if="loading" />
        <STList v-else class="payment-selection-list">
            <STListItem v-for="mandate in mandates" :key="mandate.id" :selectable="allowSelection" :element-name="allowSelection ? 'label' : 'div'" class="right-stack left-center">
                <Radio v-if="allowSelection" slot="left" v-model="selectedMandate" name="choose-mandate" :value="mandate.id" />
                <figure v-else slot="left" class="style-image-with-icon" :class="{gray: !mandate.isDefault}">
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
                <Radio slot="left" v-model="selectedMandate" name="choose-payment-mandate" :value="null" />

                <h3 class="style-title-list">
                    Nieuwe betaalkaart koppelen
                </h3>
            </STListItem>
        </STList>
    </div>
</template>

<script lang="ts">
import { Decoder } from "@simonbackx/simple-encoding";
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, LoadingButton, Radio, Spinner, STErrorsDefault, STList, STListItem, STNavigationBar, STToolbar, Toast } from "@stamhoofd/components";
import { SessionManager } from "@stamhoofd/networking";
import { Organization, OrganizationPaymentMandate, STBillingStatus } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";

import { OrganizationManager } from "../../../../classes/OrganizationManager";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        Radio,
        LoadingButton,
        STErrorsDefault,
        Spinner
    },
    model: {
        // Already vue 3 compliant
        prop: 'modelValue',
        event: 'update:modelValue'
    },
})
export default class MandateSelectionList extends Mixins(NavigationMixin){
    @Prop({ default: null })
        modelValue: string | null

    @Prop({ required: true }) 
        organization: Organization

    @Prop({ required: false, default: null }) 
        defaultStatus: STBillingStatus | null

    @Prop({ default: true }) 
        required: boolean

    @Prop({ default: true }) 
        allowSelection: boolean

    @Prop({ default: true }) 
        allowDelete: boolean

    loading = false;
    status: STBillingStatus | null = null
    deletingMandates: string[] = [];

    mounted() {
        this.loadMandates().catch(console.error)
    }

    get mandates() {
        const base = this.defaultStatus?.mandates ?? this.status?.mandates ?? [];
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
            if (found.has(mandate.details.consumerAccount || '')) {
                continue; // Skip duplicates
            }
            found.add(mandate.details.consumerAccount || '');
            cleaned.push(mandate);
        }

        // Todo: remove duplicates, preferring the first created mandate that is valid

        if (this.allowSelection) {
            return cleaned.filter(b => b.status === 'valid')
        }

        return cleaned;
    }

    get selectedMandate() {
        return this.modelValue
    }

    set selectedMandate(mandate: string | null) {
        this.$emit('update:modelValue', mandate)
    }

    async loadMandates() {
        if (this.defaultStatus) {
            return;
        }
        this.loading = true;

        try {
            this.status = await OrganizationManager.loadBillingStatus({
                owner: this
            })
            await Promise.resolve();

            this.selectedMandate = this.selectedMandate || this.mandates[0]?.id || null;
        } catch (e) {
            Toast.fromError(e).show()
        } finally {
            this.loading = false;
        }
    }

    isDeleting(mandate: OrganizationPaymentMandate): boolean {
        return this.deletingMandates.includes(mandate.id);
    }

    async deleteMandate(mandate: OrganizationPaymentMandate) {
        if (this.isDeleting(mandate)) {
            return;
        }

        if (!await CenteredMessage.confirm('Wil je deze betaalmethode ('+this.getName(mandate)+') verwijderen?', 'Ja, verwijderen', 'Je kan dit niet ongedaan maken', undefined, true)) {
            return;
        }

        this.deletingMandates.push(mandate.id);

        try {
            const result = await SessionManager.currentSession!.authenticatedServer.request({
                method: "DELETE",
                path: "/billing/mandate/" + mandate.id,
                decoder: STBillingStatus as Decoder<STBillingStatus>,
                owner: this,
                shouldRetry: false
            });

            if (this.status) {
                this.status.set(result.data);
            } else {
                if (this.defaultStatus) {
                    this.defaultStatus.set(result.data);
                }
            }

        } catch (e) {
            Toast.fromError(e).show();
        }

        // Remove
        this.deletingMandates = this.deletingMandates.filter(id => id !== mandate.id);
    }

    getName(mandate: OrganizationPaymentMandate): string {
        if (!mandate.details.consumerAccount) {
            return 'Onbekende betaalmethode'
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

    getDescription(mandate: OrganizationPaymentMandate): string {
        switch (mandate.method) {
            case 'creditcard': return mandate.details.consumerName || '';
            case 'directdebit': return mandate.details.consumerName || '';   
        }
        return '';
    }

    getLogo(mandate: OrganizationPaymentMandate): string | null {
        switch (mandate.method) {
            case 'creditcard': return null;
        }
        return null;
    }
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