<template>
    <button class="button text small" type="button" :class="{enabled: model}" data-testid="severe-disability-toggle" @click="toggle">
        <span v-if="model" v-tooltip="$t('%ZsJ')">{{ $t('%Zt6') }}</span>
        <span v-else>{{ $t('%ZsE') }}</span>
        <span class="icon arrow-down-small" />
    </button>
</template>

<script lang="ts" setup>
import { CenteredMessage } from '#overlays/CenteredMessage.ts';
import { ContextMenu, ContextMenuItem } from '#overlays/ContextMenu.ts';
import type { PlatformMember } from '@stamhoofd/structures';
const props = defineProps<{
    member: PlatformMember;
}>();

const model = defineModel<boolean>({ required: true });

async function toggle(event: MouseEvent) {
    const contextMenu = new ContextMenu([
        [
            new ContextMenuItem({
                name: $t('%ZsE'),
                description: $t('%1Is'),
                selected: model.value === false,
                action: async () => {
                    await changeValue(false);
                    return true;
                },

            }),
            new ContextMenuItem({
                name: $t('%Zt6'),
                description: $t('%ZsD'),
                selected: model.value === true,
                action: async () => {
                    await changeValue(true);
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t('%19t'),
                icon: 'external',
                action: async () => {
                    window.open('https://fin.belgium.be/nl/particulieren/belastingvoordelen/kinderopvang/belastingvermindering', '_blank');
                },
            }),
        ],
    ]);
    await contextMenu.show({
        button: event.currentTarget as HTMLElement,
        xPlacement: 'left',
    });
}

async function changeValue(to: boolean) {
    if (to === model.value) {
        return;
    }

    if (!to) {
        model.value = false;
        return;
    }

    const result = await CenteredMessage.show({
        title: $t('%Zq2'),
        description: $t('%Zsf'),
        checkbox: {
            text: $t('%Zt4', { firstName: props.member.patchedMember.firstName }),
        },
        buttons: [
            {
                text: $t('%ZsO'),
                value: 'enable',
                type: 'destructive',
                requireAcceptCheckbox: true,
            },
            {
                text: $t('%19t'),
                value: 'info',
                type: 'secundary',
                icon: 'external',
            }, {
                text: $t('%1Lh'),
                value: 'cancel',
                type: 'secundary',
            },
        ],
    });

    if (result === 'cancel') {
        return;
    }

    if (result === 'info') {
        // Open url
        window.open('https://fin.belgium.be/nl/particulieren/belastingvoordelen/kinderopvang/belastingvermindering', '_blank');
        return;
    }

    model.value = true;
}
</script>
