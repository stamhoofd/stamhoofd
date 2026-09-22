<template>
    <button class="button text small" type="button" :class="{enabled: model}" @click="toggle">
        <span v-if="model" v-tooltip="$t('Het fiscaal attest wordt aangemaakt tot de leeftijd van 21 jaar in plaats van 14 jaar')">{{ $t('Tot 21 jaar') }}</span>
        <span v-else>{{ $t('Tot 14 jaar') }}</span>
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
                name: $t('Tot 14 jaar'),
                description: $t('Standaardinstelling'),
                selected: model.value === false,
                action: async () => {
                    await changeValue(false);
                    return true;
                },

            }),
            new ContextMenuItem({
                name: $t('Tot 21 jaar'),
                description: $t('Uitzondering voor leden met zware handicap'),
                selected: model.value === true,
                action: async () => {
                    await changeValue(true);
                    return true;
                },
            }),
        ],
        [
            new ContextMenuItem({
                name: $t('Meer info'),
                icon: 'external',
                action: async () => {
                    window.open('https://fin.belgium.be/nl/particulieren/belastingvoordelen/kinderopvang/belastingvermindering', '_blank');
                },
            }),
        ],
    ]);
    await contextMenu.show({
        button: event.currentTarget as HTMLElement,
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
        title: $t('Fiscaal attest uitreiken tot hogere leeftijd van 21 jaar'),
        description: $t('Enkel voor leden met een attest van zware handicap.'),
        checkbox: {
            text: $t('{firstName} heeft een attest van zware handicap', { firstName: props.member.patchedMember.firstName }),
        },
        buttons: [
            {
                text: $t('Uitreiken tot 21 jaar'),
                value: 'enable',
                type: 'destructive',
                requireAcceptCheckbox: true,
            },
            {
                text: $t('Meer info'),
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
