<template>
    <AuditLogsContentView :object-ids="objectIds" :custom-renderers="customRenderers" :open-logs="openLogs" />
</template>

<script setup lang="ts">
import { usePresent } from '@browser/navigation';
import { AsyncComponent } from '#containers/AsyncComponent.ts';
import AuditLogsContentView from './AuditLogsContentView.vue';
import type { AuditLogCustomRenderers } from './components/RenderTextComponent';

const props = defineProps<{
    objectIds?: string[] | null;
    customRenderers?: AuditLogCustomRenderers;
}>();

const present = usePresent();

async function openLogs(objectId: string) {
    await present({
        components: [
            AsyncComponent(() => import('./AuditLogsContentView.vue'), {
                objectIds: [objectId],
                customRenderers: props.customRenderers,
                openLogs,
            }),
        ],
        modalDisplayStyle: 'popup',
    });
}
</script>
