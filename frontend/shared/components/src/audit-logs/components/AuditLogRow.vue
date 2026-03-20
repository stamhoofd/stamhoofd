<template>
    <STListItem class="right-stack" @contextmenu.prevent="canFilter ? showContext($event) : undefined">
        <template #left>
            <IconContainer :icon="log.icon" :class="log.subIcon && log.subIcon.includes('primary') ? 'primary' : (log.subIcon && log.subIcon.includes('green') ? 'theme-success' : (log.subIcon && log.subIcon.includes('red') ? 'theme-error' : 'gray'))">
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
import type { AuditLog} from '@stamhoofd/structures';
import { AuditLogReplacement, AuditLogReplacementType, AuditLogSource, AuditLogType } from '@stamhoofd/structures';
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
        canFilter?: boolean;
    }>(), {
        canFilter: true,
    });

const userDescription: unknown[] = [];

const showDescriptionInTitle = computed(() => props.log.type === AuditLogType.Unknown && props.log.description);

if (props.log.user) {
    if (props.log.source === AuditLogSource.User) {
        userDescription.push($t(`%uX`) + ' ');
    }
    else if (props.log.source === AuditLogSource.Payment) {
        userDescription.push($t(`%uY`) + ' ');
    }
    else {
        userDescription.push($t(`%uZ`) + ' ');
    }

    userDescription.push(AuditLogReplacement.create({
        id: props.log.user.id,
        value: props.log.user.name,
        type: AuditLogReplacementType.User,
    }));
}
else if (props.log.source === AuditLogSource.User) {
    userDescription.push($t(`%ua`));
}
else if (props.log.source === AuditLogSource.Anonymous) {
    userDescription.push($t(`%ub`));
}
else if (props.log.source === AuditLogSource.System) {
    userDescription.push($t(`%uc`));
}
else if (props.log.source === AuditLogSource.Payment) {
    userDescription.push($t(`%ud`));
}

const present = usePresent();

async function showContext(event: MouseEvent) {
    if (!props.log.objectId) {
        return;
    }
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t(`%ue`),
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
