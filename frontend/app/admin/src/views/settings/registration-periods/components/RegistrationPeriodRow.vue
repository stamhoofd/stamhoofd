<template>
    <STListItem v-long-press="(e) => showContextMenu(e)" :selectable="true" class="right-stack" @contextmenu.prevent="showContextMenu">
        <h2 class="style-title-list">
            {{ period.name }}
        </h2>

        <template #right>
            <span v-if="isCurrent" class="style-tag">Huidige</span>
            <span class="icon arrow-right-small gray" />
        </template>
    </STListItem>
</template>

<script lang="ts" setup>
import { usePlatform } from '@stamhoofd/components';
import { RegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod;
}>();
const platform = usePlatform();

const isCurrent = computed(() => {
    return props.period.id === platform.value.period.id;
})

function showContextMenu() {
    // todo
}

</script>
