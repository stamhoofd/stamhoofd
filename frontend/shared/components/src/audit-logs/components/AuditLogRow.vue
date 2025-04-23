<template>
    <STListItem class="right-stack" @contextmenu.prevent="canFilter ? showContext($event) : undefined">
        <template #left>
            <IconContainer :icon="log.icon" class="gray">
                <template v-if="log.subIcon" #aside>
                    <ProgressIcon :icon="log.subIcon" />
                </template>
            </IconContainer>
        </template>
        <p class="style-title-prefix-list">
            {{ Formatter.relativeTime(log.createdAt, {hours: false}) }}
        </p>

        <h3 v-if="showDescriptionInTitle" v-text="log.description" />
        <h3 v-else class="style-title-list">
            <RenderTextComponent :text="log.renderableTitle" />
        </h3>

        <p v-if="userDescription.length" class="style-description pre-wrap">
            <RenderTextComponent :text="userDescription" />
        </p>
        <p v-if="log.renderableDescription.length" class="style-description pre-wrap">
            <RenderTextComponent :text="log.renderableDescription" />
        </p>

        <p v-if="log.description && !showDescriptionInTitle" class="style-description-small pre-wrap" v-text="log.description" />

        <PatchListText v-if="log.patchList" :items="log.patchList" />
    </STListItem>
</template>

<script setup lang="ts">
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AuditLog, AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import IconContainer from '../../icons/IconContainer.vue';
import ProgressIcon from '../../icons/ProgressIcon.vue';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import AuditLogsView from '../AuditLogsView.vue';
import PatchListText from './PatchListText.vue';
import { RenderTextComponent } from './RenderTextComponent';

const props = withDefaults(
    defineProps<{
        log: AuditLog;
        canFilter: boolean;
    }>(), {
        canFilter: true,
    });

const userDescription: unknown[] = [];

const showDescriptionInTitle = computed(() => props.log.type === AuditLogType.Unknown && props.log.description);

if (props.log.user) {
    if (props.log.source === AuditLogSource.User) {
        userDescription.push($t(`6df4e1c5-81cd-4abb-a0dd-528aee6acaa3`) + ' ');
    }
    else if (props.log.source === AuditLogSource.Payment) {
        userDescription.push($t(`ba7666c5-9641-4ba2-affa-a811e1773af6`) + ' ');
    }
    else {
        userDescription.push($t(`6137567d-3cd1-4b89-bfcb-7cbebb60e43a`) + ' ');
    }

    userDescription.push(AuditLogReplacement.create({
        id: props.log.user.id,
        value: props.log.user.name,
        type: AuditLogReplacementType.User,
    }));
}
else if (props.log.source === AuditLogSource.User) {
    userDescription.push($t(`09219c0e-ed21-49eb-889d-9409d5f66006`));
}
else if (props.log.source === AuditLogSource.Anonymous) {
    userDescription.push($t(`c2fd98f0-5081-4ce2-8313-ca45ee302eda`));
}
else if (props.log.source === AuditLogSource.System) {
    userDescription.push($t(`6ccdb9e8-c878-4bd9-a66e-8366ad66c0d1`));
}
else if (props.log.source === AuditLogSource.Payment) {
    userDescription.push($t(`12d14007-0c25-4bec-86f6-d018260d8644`));
}

const present = usePresent();

async function showContext(event: MouseEvent) {
    if (!props.log.objectId) {
        return;
    }
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`27a704b7-9e97-432f-bfb4-ab8322b2a016`),
                action: async () => {
                    await present({
                        components: [
                            new ComponentWithProperties(AuditLogsView, {
                                objectIds: [props.log.objectId],
                            }),
                        ],
                        modalDisplayStyle: 'popup',
                    });
                },
            }),
        ],
    ]);

    await menu.show({ clickEvent: event });
}

</script>
