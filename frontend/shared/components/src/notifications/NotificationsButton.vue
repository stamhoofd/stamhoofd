<template>
    <button v-if="enabled" v-tooltip="$t('%1FR')" class="button icon notification" type="button" data-testid="notifications-button" @click="open">
        <span v-if="unreadCount > 0" class="bubble" data-testid="notifications-unread-count">{{ unreadCount }}</span>
    </button>
</template>

<script setup lang="ts">
import { ComponentWithProperties, NavigationController } from '@simonbackx/vue-app-navigation';
import { computed, watch } from 'vue';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import { useFeatureFlag } from '#hooks/useFeatureFlag.ts';
import { useUser } from '#hooks/useUser.ts';
import { useVisibilityChange } from '#hooks/useVisibilityChange.ts';
import { usePositionableSheet } from '#tables/usePositionableSheet.ts';
import { useUnreadNotificationsCount } from './useUnreadNotificationsCount';

const user = useUser();
const hasFeatureFlag = useFeatureFlag();
const { presentPositionableSheet } = usePositionableSheet();
const { count: unreadCount, refresh } = useUnreadNotificationsCount();

const enabled = computed(() => !!user.value && hasFeatureFlag('notifications'));
const refreshInterval = 15 * 1000;

async function refreshCount(options: { minimumInterval?: number } = {}) {
    if (enabled.value) {
        await refresh(options);
    }
}

watch(enabled, () => refreshCount({ minimumInterval: refreshInterval }), { immediate: true });

useVisibilityChange(async () => {
    await refreshCount({ minimumInterval: refreshInterval });
});

async function open(event: MouseEvent) {
    await presentPositionableSheet(event, {
        components: [
            new ComponentWithProperties(NavigationController, {
                root: AsyncComponent(() => import('./NotificationsView.vue'), {
                    onReadChange: () => {
                        refreshCount().catch(console.error);
                    },
                }),
            }),
        ],
    }, {
        width: 450,
    });
}
</script>
