<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`d131b883-1500-4568-ba8e-b36f9a960c4e`)"/>

        <main>
            <h1>
                {{ $t('a361f76c-7ab9-404d-a904-473e48c76e96') }}
            </h1>

            <p class="st-list-description">
                {{ $t('738b8ccf-bd5c-4521-bdeb-127914ee90a7') }}
            </p>

            <STInputBox class="max" :title="$t(`2cec0671-0d30-437d-843b-85de648d01bc`)">
                <div v-copyable class="input-icon-container right icon copy gray">
                    <div class="token-input input selectable">
                        <div>{{ user.token }}</div>
                    </div>
                </div>
            </STInputBox>
            <p class="style-description-small">
                {{ $t('cce09c3a-eaea-4183-89db-7e519c13d2f8') }} {{ formatDate(user.expiresAt) }}
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss">
                    {{ $t('e59cf50c-5654-467c-a168-34f6a5194cf1') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { CenteredMessage, STInputBox, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { ApiUserWithToken } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';

@Component({
    components: {
        STToolbar,
        STNavigationBar,
        STInputBox,
    },
})
export default class CopyApiTokenView extends Mixins(NavigationMixin) {
    @Prop({ required: true })
    user!: ApiUserWithToken;

    formatDate(date: Date) {
        return Formatter.date(date, true);
    }

    async shouldNavigateAway() {
        return await CenteredMessage.confirm('Heb je jouw key opgeslagen?', 'Ja, opgeslagen', 'Je kan jouw API-key hierna nooit meer bekijken.');
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
