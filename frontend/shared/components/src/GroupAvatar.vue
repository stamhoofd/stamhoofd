<template>
    <IconContainer
        v-color="group.id"
        v-tooltip="tooltip"
        :class="logoSrc ? 'white transparent' : ''"
        :aside-icon="withAside ? asideIcon : undefined"
    >
        <figure class="group-avatar">
            <div v-if="logoSrc" class="logo">
                <img :src="logoSrc" :srcset="logoSrcSet">
            </div>
            <span v-else-if="allowEmpty" class="icon gray" />
            <div v-else v-color="group.id" class="letter-logo" :data-length="letters.length">
                {{ letters }}
            </div>
        </figure>
    </IconContainer>
</template>

<script lang="ts" setup>
import type { Group } from '@stamhoofd/structures';
import { GroupType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed, ref } from 'vue';
import { useOrganization } from './hooks/useOrganization.ts';
import IconContainer from './icons/IconContainer.vue';

const props = withDefaults(defineProps<{
    group: Group;
    allowEmpty?: boolean;
    withAside?: boolean;
}>(), {
    withAside: true,
    allowEmpty: false,
});
const organization = useOrganization();
const letters = computed(() => Formatter.firstLetters(props.group.settings.name, 2));
const t = ref(0);
const isDifferentPeriod = computed(() => organization.value && organization.value.period.period.id !== props.group.periodId);

const asideIcon = computed(() => {
    if (props.group.type === GroupType.WaitingList) {
        return 'clock tiny stroke';
    }

    if (isDifferentPeriod.value) {
        return 'lock tiny stroke';
    }

    if (props.group.notYetOpen) {
        return 'dot yellow stroke';
    }

    if (props.group.notYetOpen) {
        return 'dot yellow stroke';
    }

    if (props.group.closed || ((!props.group.waitingList || props.group.waitingList.closed) && props.group.settings.getRemainingStockIncludingPricesAndOptions(props.group) === 0)) {
        return 'dot red stroke';
    }

    return 'dot green stroke';
});

const tooltip = computed(() => {
    if (isDifferentPeriod.value) {
        return $t('%1cE');
    }

    if (props.group.closed) {
        return $t('%1Yj');
    }

    return undefined;
});

setInterval(() => {
    t.value += 1;
}, 1000);

const logoSrc = computed(() => props.group.settings.squarePhoto?.getPathForSize(24, 24));

const logoSrcSet = computed(() => {
    if (!props.group.settings.squarePhoto) {
        return undefined;
    }
    const photo = props.group.settings.squarePhoto;
    return photo.getPathForSize(24, 24) + ' 1x, ' + photo.getPathForSize(24 * 2, 24 * 2) + ' 2x, ' + photo.getPathForSize(24 * 3, 24 * 3) + ' 3x';
});
</script>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.group-avatar {
    user-select: none;

    .letter-logo {
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        border-radius: min($border-radius, var(--block-width, 40px) / 4);
        text-align: center;
        background: $color-primary-light;
        color: $color-primary-dark;
        text-transform: uppercase;
        line-height: var(--block-width, 40px);
        font-weight: $font-weight-bold;
        position: relative;

        font-size: min(calc(var(--block-width, 40px) / 2.5), 14px);

        &[data-length="1"] {
            font-size: min(calc(var(--block-width, 40px) / 2), 14px);
        }
    }

    .logo {
        img {
            width: var(--block-width, 40px);
            height: var(--block-width, 40px);
            object-fit: contain;
        }
        width: var(--block-width, 40px);
        height: var(--block-width, 40px);
        //margin: -5px 0;
        border-radius: min($border-radius, var(--block-width, 40px) / 4);
        overflow: hidden;
        //background: $color-background;
        //box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.05), 0px 2px 15px rgba(0, 0, 0, 0.05);
        position: relative;

        &::after {
            border-radius: 12px;
            // inset box shadow doesn't work over img tags
            //box-shadow: inset 0px 0px 0px 2px rgba(0, 0, 0, 0.2);
            content: '';
            display: block;
            height: 100%;
            position: absolute;
            top: 0;
            width: 100%;

            mix-blend-mode: luminosity;
        }
    }
}
</style>
