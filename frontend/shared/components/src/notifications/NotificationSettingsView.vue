<template>
    <LoadingViewTransition :error-box="errors.errorBox">
        <div v-if="preferences" class="st-view" data-testid="notification-settings-view">
            <STNavigationBar :title="$t('Instellingen voor meldingen')" />

            <main>
                <h1>{{ $t('Instellingen voor meldingen') }}</h1>
                <p>{{ $t('Kies welke meldingen je wilt ontvangen en waar.') }}</p>

                <p v-if="types.length === 0" class="info-box">
                    {{ $t('Er zijn geen meldingen die je kan ontvangen.') }}
                </p>
                <STList v-else>
                    <STListItem class="right-stack">
                        <template #right>
                            <span v-for="channel of channels" :key="channel" class="notification-settings-column style-description-small">
                                {{ NotificationChannelHelper.getName(channel) }}
                            </span>
                        </template>
                    </STListItem>

                    <STListItem v-for="type of types" :key="type" class="right-stack" data-testid="notification-preference-row" :data-type="type">
                        <h3 class="style-title-list">
                            {{ NotificationTypeHelper.getName(type) }}
                        </h3>

                        <template #right>
                            <div v-for="channel of channels" :key="channel" class="notification-settings-column">
                                <Checkbox :model-value="isEnabled(type, channel)" :data-testid="'notification-preference-' + channel" @update:model-value="setEnabled(type, channel, $event)" />
                            </div>
                        </template>
                    </STListItem>
                </STList>
            </main>
        </div>
    </LoadingViewTransition>
</template>

<script setup lang="ts">
import { NotificationChannel, NotificationChannelHelper } from '@stamhoofd/structures/notifications/NotificationChannel.js';
import { NotificationPreference } from '@stamhoofd/structures/notifications/NotificationPreference.js';
import type { NotificationType } from '@stamhoofd/structures/notifications/NotificationType.js';
import { NotificationTypeHelper } from '@stamhoofd/structures/notifications/NotificationType.js';
import type { Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';
import LoadingViewTransition from '#containers/LoadingViewTransition.vue';
import { ErrorBox } from '#errors/ErrorBox.ts';
import { useErrors } from '#errors/useErrors.ts';
import { usePlatform } from '#hooks/usePlatform.ts';
import { useUser } from '#hooks/useUser.ts';
import Checkbox from '#inputs/Checkbox.vue';
import STList from '#layout/STList.vue';
import STListItem from '#layout/STListItem.vue';
import STNavigationBar from '#navigation/STNavigationBar.vue';
import { Toast } from '#overlays/Toast.ts';
import { useNotificationActions } from './useNotificationActions';

const user = useUser();
const platform = usePlatform();
const errors = useErrors();
const { fetchPreferences, setPreferences } = useNotificationActions();

const channels = Object.values(NotificationChannel);
const preferences = ref(null) as Ref<NotificationPreference[] | null>;

const types = computed(() => {
    if (!user.value) {
        return [];
    }
    return NotificationTypeHelper.getRelevantTypes(user.value, platform.value);
});

onMounted(() => {
    loadPreferences().catch(console.error);
});

async function loadPreferences() {
    try {
        preferences.value = await fetchPreferences();
    } catch (e) {
        errors.errorBox = new ErrorBox(e);
    }
}

function getKey(type: NotificationType, channel: NotificationChannel) {
    return type + '/' + channel;
}

/**
 * Changes that are not stored yet. They are sent one request at a time, so a slower request can't overwrite a newer change.
 */
const pending = ref(new Map<string, NotificationPreference>());
let isSaving = false;

function isEnabled(type: NotificationType, channel: NotificationChannel) {
    const pendingPreference = pending.value.get(getKey(type, channel));
    if (pendingPreference) {
        return pendingPreference.enabled;
    }
    return preferences.value?.find(p => p.type === type && p.channel === channel)?.enabled ?? true;
}

function setEnabled(type: NotificationType, channel: NotificationChannel, enabled: boolean) {
    pending.value.set(getKey(type, channel), NotificationPreference.create({ type, channel, enabled }));
    save().catch(console.error);
}

async function save() {
    if (isSaving || pending.value.size === 0) {
        return;
    }
    isSaving = true;
    const batch = [...pending.value.entries()];

    try {
        preferences.value = await setPreferences(batch.map(([, preference]) => preference));
    } catch (e) {
        // The checkboxes fall back to the last stored state
        Toast.fromError(e).show();
    } finally {
        isSaving = false;

        // Keep changes that were made while this request was pending
        for (const [key, preference] of batch) {
            if (pending.value.get(key) === preference) {
                pending.value.delete(key);
            }
        }
    }

    await save();
}
</script>

<style lang="scss">
.notification-settings-column {
    width: 70px;
    display: flex;
    justify-content: center;
    text-align: center;
}
</style>
