<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ formatDate(deadline.startDate, true) }} - {{ formatDate(deadline.endDate) }}
        </h2>
        <p class="style-description-small">
            {{ $t('e07f97ee-d8c6-4259-924b-0af0588646bb') }} {{ Formatter.endDate(deadline.deadline, false, true) }}
        </p>

        <template #right>
            <span class="icon arrow-right-small gray"/>
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { EventNotificationDeadline } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

defineProps<{
    deadline: EventNotificationDeadline;
}>();

</script>
