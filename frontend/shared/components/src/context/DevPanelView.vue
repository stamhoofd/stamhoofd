<template>
    <SaveView :loading="saving" :title="$t(`%1T`)" @save="save">
        <h1>
            {{ $t('%1T') }}
        </h1>

        <hr><h2>{{ $t('%a0') }}</h2>
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
                    {{ $t('%S') }}
                </h3>
                <input v-if="releaseChannel === 'custom'" v-model="customChannel" type="text" class="input option" :placeholder="$t(`%a1`)">
            </STListItem>
        </STList>
    </SaveView>
</template>

<script lang="ts" setup>
import { useDismiss } from '@simonbackx/vue-app-navigation';
import Radio from '#inputs/Radio.vue';
import SaveView from '#navigation/SaveView.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import { Toast } from '#overlays/Toast.ts';
import { AppManager } from '@stamhoofd/networking/AppManager';
import { Storage } from '@stamhoofd/networking/Storage';
import { onMounted, ref } from 'vue';

const dismiss = useDismiss();
const releaseChannel = ref('');
const customChannel = ref('');
const saving = ref(false);
const availableChannels = ref<{ name: string; url: string }[]>([]);

onMounted(() => {
    availableChannels.value = [
        { name: $t(`%v6`), url: STAMHOOFD.APP_UPDATE_SERVER_URL },
        { name: $t(`%1N`), url: STAMHOOFD.APP_UPDATE_PRODUCTION_SERVER_URL },
        { name: $t(`%24`), url: STAMHOOFD.APP_UPDATE_STAGING_SERVER_URL },
        { name: $t(`%2F`), url: STAMHOOFD.APP_UPDATE_DEVELOPMENT_SERVER_URL },
    ].filter((channel): channel is { name: string; url: string } => channel.url !== undefined);

    Storage.keyValue.getItem('UPDATE_SERVER').then((value) => {
        releaseChannel.value = value ?? '';
        customChannel.value = value ?? '';

        if (!availableChannels.value.find(c => c.url === value)) {
            releaseChannel.value = 'custom';
        }
    }).catch(console.error);
});

async function saveChannel() {
    if (releaseChannel.value === '') {
        await Storage.keyValue.removeItem('UPDATE_SERVER');
    }
    if (releaseChannel.value === 'custom') {
        // Check valid
        new URL(customChannel.value);
        await Storage.keyValue.setItem('UPDATE_SERVER', customChannel.value);
    } else {
        await Storage.keyValue.setItem('UPDATE_SERVER', releaseChannel.value);
    }
    await AppManager.shared.checkUpdates({
        visibleCheck: 'text',
        visibleDownload: true,
        installAutomatically: true,
        checkTimeout: 15 * 1000,
        force: true,
        channel: releaseChannel.value === 'custom' ? customChannel.value : releaseChannel.value,
    });
}

async function save() {
    if (saving.value) {
        return;
    }
    saving.value = true;

    try {
        await saveChannel();
        new Toast($t(`%54`), 'success').show();
        await dismiss({ force: true });
    } catch (e) {
        Toast.fromError(e as Error).show();
    }

    saving.value = false;
}
</script>
