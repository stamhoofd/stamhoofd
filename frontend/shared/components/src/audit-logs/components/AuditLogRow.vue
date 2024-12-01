<template>
    <STListItem class="right-stack">
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
        <p v-if="log.user" class="style-description">
            Door {{ log.user.name }}
        </p>

        <p v-if="log.description" class="style-description-small pre-wrap" v-text="log.description" />

        <PatchListText v-if="log.patchList" :items="log.patchList" />
    </STListItem>
</template>

<script setup lang="ts">
import { AuditLog } from '@stamhoofd/structures';
import IconContainer from '../../icons/IconContainer.vue';
import ProgressIcon from '../../icons/ProgressIcon.vue';
import PatchListText from './PatchListText.vue';
import { RenderTextComponent } from './RenderTextComponent';
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    log: AuditLog;
}>();

</script>
