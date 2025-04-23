<template>
    <SaveView :loading="saving" :title="$t(`Developers`)" @save="save">
        <h1>
            {{ $t('f6de6c56-6326-42b2-b586-2bf607e058a7') }}
        </h1>

        <hr><h2>{{ $t('e909e3d1-516f-4284-8923-0390c95ae290') }}</h2>
        <STList>
            <STListItem v-for="r in availableChannels" :key="r.url" :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="releaseChannel" :value="r.url" />
                </template>
                <h3 class="style-title-list">
                    {{ r.name }}
                </h3>
                <p class="style-description-small">
                    {{ r.url }}
                </p>
            </STListItem>
            <STListItem :selectable="true" element-name="label">
                <template #left>
                    <Radio v-model="releaseChannel" value="custom" />
                </template>
                <h3 class="style-title-list">
                    {{ $t('0d256e87-ab44-4051-9efc-4749c8edb0c0') }}
                </h3>
                <input v-if="releaseChannel === 'custom'" v-model="customChannel" type="text" class="input option" :placeholder="$t(`761c7de2-e697-4c39-9970-82d05fc886ca`)">
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts">
import { NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Component, Mixins } from '@simonbackx/vue-app-navigation/classes';
import { Radio, SaveView, STList, STListItem, Toast, TooltipDirective } from '@stamhoofd/components';
import { AppManager, Storage } from '@stamhoofd/networking';

@Component({
    components: {
        SaveView,
        Radio,
        STList,
        STListItem,
    },
    directives: {
        tooltip: TooltipDirective,
    },
})
export default class DevPanelView extends Mixins(NavigationMixin) {
    releaseChannel = '';
    customChannel = '';
    saving = false;
    availableChannels: { name: string; url: string }[] = [];

    mounted() {
        this.availableChannels = [
            {
                name: $t(`Standaard`),
                url: STAMHOOFD.APP_UPDATE_SERVER_URL,
            },
            {
                name: $t(`Production`),
                url: STAMHOOFD.APP_UPDATE_PRODUCTION_SERVER_URL,
            },
            {
                name: $t(`Staging`),
                url: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL,
            },
            {
                name: $t(`Development`),
                url: STAMHOOFD.APP_UPDATE_DEVELOPMENT_SERVER_URL,
            },
        ].filter(c => c.url !== undefined) as any;

        Storage.keyValue.getItem('UPDATE_SERVER').then((value) => {
            this.releaseChannel = value ?? '';
            this.customChannel = value ?? '';

            if (!this.availableChannels.find(c => c.url === value)) {
                this.releaseChannel = 'custom';
            }
        }).catch(console.error);
    }

    async saveChannel() {
        if (this.releaseChannel === '') {
            await Storage.keyValue.removeItem('UPDATE_SERVER');
        } if (this.releaseChannel === 'custom') {
            // Check valid
            new URL(this.customChannel);
            await Storage.keyValue.setItem('UPDATE_SERVER', this.customChannel);
        }
        else {
            await Storage.keyValue.setItem('UPDATE_SERVER', this.releaseChannel);
        }
        await AppManager.shared.checkUpdates({
            visibleCheck: 'text',
            visibleDownload: true,
            installAutomatically: true,
            checkTimeout: 15 * 1000,
            force: true,
            channel: this.releaseChannel === 'custom' ? this.customChannel : this.releaseChannel,
        });
    }

    async save() {
        if (this.saving) {
            return;
        }
        this.saving = true;

        try {
            await this.saveChannel();
            new Toast($t(`Wijzigingen opgeslagen`), 'success').show();
            this.dismiss({ force: true });
        }
        catch (e) {
            Toast.fromError(e as Error).show();
        }

        this.saving = false;
    }
}
</script>
