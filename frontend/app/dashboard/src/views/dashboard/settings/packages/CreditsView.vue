<template>
    <div class="st-view">
        <STNavigationBar title="Jouw tegoed geschiedenis" :dismiss="canDismiss" :pop="canPop" />
        
        <main>
            <h1>
                <span>Jouw tegoed geschiedenis</span>
            </h1>

            <p v-if="credits.length == 0" class="info-box">
                Geen tegoed geschiedenis
            </p>

            <STList v-else>
                <STListItem v-for="credit in credits" :key="credit.id">
                    <h3 class="style-title-list">
                        {{ credit.description }}
                    </h3>
                    <p class="style-description">
                        {{ formatDateTime(credit.createdAt) }}
                    </p>

                    <p v-if="credit.expireAt !== null" class="style-description">
                        Vervalt op {{ formatDateTime(credit.expireAt) }}
                        <span v-if="isExpired(credit)" class="style-tag error">Vervallen</span>
                    </p>
                    <template #right>
                        {{ formatPriceChange(credit.change) }}
                    </template>
                </STListItem>
            </STList>
        </main>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { BackButton,STList, STListItem, STNavigationBar, STToolbar } from "@stamhoofd/components"
import { STBillingStatus, STCredit } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from "vue-property-decorator";

@Component({
    components: {
        STNavigationBar,
        STToolbar,
        STList,
        STListItem,
        BackButton,
    },
    filters: {
        priceChange: Formatter.priceChange.bind(Formatter),
        dateTime: Formatter.dateTime.bind(Formatter)
    },
})
export default class CreditsView extends Mixins(NavigationMixin){
    @Prop({ required: true })
    status!: STBillingStatus

    get credits() {
        const now = new Date()
        return this.status.credits.filter(c => c.expireAt === null || (c.expireAt > now || c.change > 0))
    }

    isExpired(credit: STCredit) {
        return credit.expireAt !== null && credit.expireAt < new Date()
    }
}
</script>