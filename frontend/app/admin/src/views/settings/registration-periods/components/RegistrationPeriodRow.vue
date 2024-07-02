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
import { ContextMenu, ContextMenuItem } from '@stamhoofd/components';
import { Platform, RegistrationPeriod } from '@stamhoofd/structures';
import { computed } from 'vue';

const props = defineProps<{
    period: RegistrationPeriod,
    platform: Platform
}>();
const emit = defineEmits(['activate'])

const isCurrent = computed(() => {
    return props.period.id === props.platform.period.id;
})

async function showContextMenu(event: MouseEvent) {
    const menu = new ContextMenu([
        [
            new ContextMenuItem({
                name: 'Instellen als huidig werkjaar',
                disabled: isCurrent.value,
                action: () => {
                    emit('activate')
                }
            })
        ]
    ])

    await menu.show({ clickEvent: event })
}

</script>
