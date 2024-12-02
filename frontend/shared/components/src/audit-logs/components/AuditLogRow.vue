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

        <h3 class="style-title-list">
            <RenderTextComponent :text="log.renderableTitle" />
        </h3>
        <p v-if="userDescription.length" class="style-description">
            <RenderTextComponent :text="userDescription" />
        </p>

        <p v-if="log.description" class="style-description-small pre-wrap" v-text="log.description" />

        <PatchListText v-if="log.patchList" :items="log.patchList" />
    </STListItem>
</template>

<script setup lang="ts">
import { AuditLog, AuditLogReplacement, AuditLogReplacementType, AuditLogSource } from '@stamhoofd/structures';
import IconContainer from '../../icons/IconContainer.vue';
import ProgressIcon from '../../icons/ProgressIcon.vue';
import PatchListText from './PatchListText.vue';
import { RenderTextComponent } from './RenderTextComponent';
import { Formatter } from '@stamhoofd/utility';
import { ContextMenu, ContextMenuItem } from '../../overlays/ContextMenu';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import AuditLogsView from '../AuditLogsView.vue';

const props = withDefaults(
    defineProps<{
        log: AuditLog;
        canFilter: boolean;
    }>(), {
        canFilter: true,
    });

const userDescription: unknown[] = [];

if (props.log.user) {
    if (props.log.source === AuditLogSource.User) {
        userDescription.push('Door ');
    }
    else if (props.log.source === AuditLogSource.Payment) {
        userDescription.push('Indirect veroorzaakt door betaalstatuswijziging door ');
    }
    else {
        userDescription.push('Automatische actie veroorzaakt door ');
    }

    userDescription.push(AuditLogReplacement.create({
        id: props.log.user.id,
        value: props.log.user.name,
        type: AuditLogReplacementType.User,
    }));
}
else if (props.log.source === AuditLogSource.User) {
    userDescription.push('Door verwijderde gebruiker');
}
else if (props.log.source === AuditLogSource.Anonymous) {
    userDescription.push('Door anonieme gebruiker');
}
else if (props.log.source === AuditLogSource.System) {
    userDescription.push('Automatische systeemactie');
}
else if (props.log.source === AuditLogSource.Payment) {
    userDescription.push('Indirect veroorzaakt door betaalstatuswijziging');
}

const present = usePresent();

async function showContext(event: MouseEvent) {
    if (!props.log.objectId) {
        return;
    }
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Toon alle gebeurtenissen van dit object',
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
