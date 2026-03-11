<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`%1r`)" />

        <main>
            <h1>
                {{ $t('%K6') }}
            </h1>

            <p>
                {{ $t('%K7') }}
            </p>

            <STInputBox class="max" :title="$t(`%K9`)">
                <div v-copyable class="input-icon-container right icon copy gray">
                    <div class="token-input input selectable">
                        <div>{{ user.token }}</div>
                    </div>
                </div>
            </STInputBox>
            <p class="style-description-small">
                {{ $t('%1JJ') }} {{ formatDate(user.createdAt) }}
                <template v-if="user.expiresAt">
                    {{ $t('%K4') }} {{ formatDate(user.expiresAt) }}
                </template>
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    {{ $t('%K8') }}
                </button>
            </template>
        </STToolbar>
    </div>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins, Prop } from '@simonbackx/vue-app-navigation/classes';
import { CenteredMessage, STInputBox, STNavigationBar, STToolbar } from '@stamhoofd/components';
import { ApiUserWithToken } from '@stamhoofd/structures';

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
