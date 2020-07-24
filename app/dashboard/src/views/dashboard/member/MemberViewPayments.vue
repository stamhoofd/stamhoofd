<template>
    <div class="view-payments">
        <h2>Betaling</h2>
        <main>
            <dl class="details-grid" v-for="payment in payments">
                <dt>Bedrag</dt>
                <dd>{{ payment.price | price }}</dd>

                <dt>Bankrekening</dt>
                <dd>{{ organization.meta.iban }}</dd>

                <dt>BIC</dt>
                <dd>{{ organization.meta.bic }}</dd>

                <dt>Mededeling</dt>
                <dd>{{ payment.transferDescription }}</dd>

                <dt>Status</dt>
                <dd v-if="payment.status == 'Succeeded'">
                    Betaald
                </dd>
                <dd v-else>
                    Nog niet betaald
                </dd>
            </dl>
        </main>

        <STToolbar v-if="!member.paid">
            <template #left />
            <template #right>
                <button class="button primary">
                    Markeer als betaald
                    <div class="dropdown" @click.stop="" />
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { STToolbar } from "@stamhoofd/components";
import { Component, Prop,Vue } from "vue-property-decorator";
import { DecryptedMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { OrganizationManager } from '../../../classes/OrganizationManager';

@Component({ 
    components: { 
        STToolbar 
    },
    filters: {
        price: Formatter.price
    }
})
export default class MemberViewPayments extends Vue {
    @Prop()
    member!: DecryptedMember;

    organization = OrganizationManager.organization

    get payments() {
        return this.member.registrations.map(r => r.payment)
    }
}
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;
@use '@stamhoofd/scss/base/text-styles.scss';

.view-payments {
    padding: 10px 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    > h2 {
        @extend .style-title-2;
        margin: 20px 0;
    }
}
</style>
