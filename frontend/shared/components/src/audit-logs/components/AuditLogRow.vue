<template>
    <STListItem class="right-stack">
        <template #left>
            <IconContainer :icon="log.icon">
                <template v-if="log.subIcon" #aside>
                    <ProgressIcon :icon="log.subIcon" />
                </template>
            </IconContainer>
        </template>

        <h3 class="style-title-list">
            {{ log.title }}
        </h3>
        <p class="style-description">
            {{ formatDateTime(log.createdAt, false, true) }}
        </p>
        <p v-if="log.user" class="style-description">
            Door {{ log.user.name }}
        </p>

        <p v-if="log.description" class="style-description-small pre-wrap" v-text="log.description" />
    </STListItem>
</template>

<script setup lang="ts">
import { AuditLog } from '@stamhoofd/structures';
import IconContainer from '../../icons/IconContainer.vue';
import ProgressIcon from '../../icons/ProgressIcon.vue';

defineProps<{
    log: AuditLog;
}>();

</script>
