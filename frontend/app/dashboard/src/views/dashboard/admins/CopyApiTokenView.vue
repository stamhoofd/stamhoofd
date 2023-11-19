<template>
    <div class="st-view">
        <STNavigationBar title="Token" :dismiss="canDismiss" />

        <main>
            <h1>
                Sla jouw key op
            </h1>
        
            <p class="st-list-description">
                Hieronder kan je jouw key kopiëren. Bewaar deze goed, want je kan deze nooit meer opvragen.
            </p>

            <STInputBox title="API-key" class="max">
                <div v-copyable class="input-icon-container right icon copy gray">
                    <div class="token-input input selectable">
                        <div>{{ user.token }}</div>
                    </div>
                </div>
            </STInputBox>
            <p class="style-description-small">
                Geldig tot {{ formatDate(user.expiresAt) }}
            </p>
        </main>

        <STToolbar>
            <template slot="right">
                <button class="button primary" type="button" @click="dismiss">
                    Klaar
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from "@simonbackx/vue-app-navigation";
import { CenteredMessage, STInputBox,STNavigationBar, STToolbar } from "@stamhoofd/components";
import { ApiUserWithToken } from "@stamhoofd/structures";
import { Formatter } from "@stamhoofd/utility";
import { Component, Mixins, Prop } from "vue-property-decorator";


@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STInputBox
    }
})
export default class CopyApiTokenView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
        user!: ApiUserWithToken

    formatDate(date: Date) {
        return Formatter.date(date, true)
    }

    async shouldNavigateAway() {
        return await CenteredMessage.confirm("Heb je jouw key opgeslagen?", "Ja, opgeslagen", "Je kan jouw API-key hierna nooit meer bekijken.")
    }
}
</script>

<style lang="scss">
    .token-input.input:not(textarea) {
        padding: 5px 0;
        padding-right: 40px;
        padding-left: 10px;
        height: auto;

        text-overflow: clip;
        overflow: visible;
        white-space: pre-wrap;
        word-break: break-all;
    }
</style>