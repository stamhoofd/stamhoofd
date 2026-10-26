<template>
    <div class="webshop-cart-button">
        <button class="button primary full" type="button" data-testid="open-cart-button" @click="emit('open')">
            <span class="icon basket" />
            <span class="title">{{ $t('Winkelmandje openen') }}</span>
            <span class="separator" />
            <span class="count">{{ count }}</span>
        </button>
    </div>
</template>

<script lang="ts" setup>
/**
 * Below the products of a webshop with a cart: sticks to the bottom of the screen, so the cart stays within reach on a long page
 */
defineProps<{
    count: number;
}>();

const emit = defineEmits<{
    open: [];
}>();
</script>

<style lang="scss">
@use "@stamhoofd/scss/base/variables.scss" as *;

.webshop-cart-button {
    position: sticky;
    bottom: 0;
    z-index: 1;
    // A margin above the button instead of padding: while it sticks, the content stays visible right up to the button
    margin-top: 15px;
    padding: 0 0 calc(15px + var(--st-safe-area-bottom, 0px));
    background: $color-current-background;

    > .button {
        // The count gets the same space on both sides of it
        padding-right: 15px;

        > .icon {
            flex-shrink: 0;
        }

        // Only the title shortens on small screens, the count stays readable
        > .title {
            flex-grow: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left;
        }

        > .separator {
            flex-shrink: 0;
            align-self: stretch;
            width: $border-width;
            margin: 0 15px;
            background: currentColor;
            opacity: 0.4;
        }

        > .count {
            flex-shrink: 0;
            min-width: 24px;
            text-align: center;
        }
    }
}
</style>
