<template>
    <STListItem :selectable="true" class="right-stack">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>


        <template #right>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { MembershipTypeConfig, RegistrationPeriod } from '@stamhoofd/structures';

defineProps<{
    config: MembershipTypeConfig;
    period: RegistrationPeriod
}>();
</script>
