<template>
    <div class="st-view">
        <STNavigationBar :title="$t(`b1d528c7-1e05-48de-aadd-d30c28581bf2`)" />

        <main>
            <h1>
                {{ $t('dd939547-4b02-4ee5-a134-7901eb0dfa27') }}
            </h1>

            <p>
                {{ $t('21602156-65ef-4761-85e6-4d0c04b68636') }}
            </p>

            <STInputBox class="max" :title="$t(`da7c1f63-529d-47c6-8d2d-87e5cb98a411`)">
                <div v-copyable class="input-icon-container right icon copy gray">
                    <div class="token-input input selectable">
                        <div>{{ user.token }}</div>
                    </div>
                </div>
            </STInputBox>
            <p class="style-description-small">
                {{ $t('b6391640-1e01-47f9-913d-360fb0903b75') }} {{ formatDate(user.createdAt) }}
                <template v-if="user.expiresAt">
                    {{ $t('52ab641f-5864-4fac-8c52-0df00ad7e0a9') }} {{ formatDate(user.expiresAt) }}
                </template>
            </p>
        </main>

        <STToolbar>
            <template #right>
                <button class="button primary" type="button" @click="dismiss()">
                    {{ $t('895b521c-da10-4fb6-9417-c8058a3cd858') }}
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
