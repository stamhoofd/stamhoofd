<template>
    <li
        :class="'calculation-remark ' + (props.remark.type ?? 'info')"
    >
        <span :class="'icon '+icon" />
        <span class="text">{{ remark.text }}</span>
    </li>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { CalculationRemark } from './classes/CalculationOutput';

const props = defineProps<{
    remark: CalculationRemark;
}>();

const icon = computed(() => {
    switch (props.remark.type) {
        case 'warning':
            return 'exclamation yellow';
        case 'error':
            return 'exclamation-two red';
        default:
            return 'info-text';
    }
});

</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

li.calculation-remark {
    list-style: none;
    padding: 0 10px;
    background: $color-background-shade;
    border-radius: $border-radius;
    margin: 5px 0;
    font-size: 14px;
    line-height: 1.4;
    display: flex;
    flex-direction: row;
    align-items: center;
    vertical-align: middle;

    &:first-child {
        margin-top: 0;
    }
    &:last-child {
        margin-bottom: 0;
    }

    &.error {
        background: $color-error-background;
        color: $color-error-dark;
    }

    &.warning {
        background: $color-warning-background;
        color: $color-warning-dark;
    }

    .icon:first-child {
        margin-right: 5px;
        flex-shrink: 0;
    }

    .text {
        padding: 11px 0;
    }

    &.more {
        cursor: help;

        .icon:last-child {
            display: block;
            flex-shrink: 0;
            margin-left: auto;
            padding-left: 5px;
            transform: translate(0, 0);
            opacity: 0.5;
            transition: transform 0.2s, opacity 0.2s;
        }

        &:hover {
            .icon:last-child {
                transform: translate(5px, 0);
                opacity: 1;
            }
        }
    }
}
</style>
