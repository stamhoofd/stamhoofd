<template>
    <UColorModeSelect
        class="site-color-mode-select"
        size="sm"
        variant="none"
        trailing-icon="stamhoofd:arrow-down-small"
        :ui="{ content: 'site-color-mode-menu' }"
        aria-label="Kleurmodus"
    />
</template>

<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;
@use '@stamhoofd/scss/base/text-styles' as *;

.site-color-mode-select {
    @extend %style-input-box;
    min-height: 44px;
    padding: 6px 40px;
    color: $color-dark;
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover { border-color: $color-primary-gray-light; }
    &:active { background: $color-background-shade-darker; }

    [data-slot='leading'] { padding-left: 12px; }
    [data-slot='trailing'] { padding-right: 12px; }

    .iconify {
        width: 20px;
        height: 20px;
        color: $color-gray-4;
    }
}

.site-color-mode-menu {
    @extend %style-overlay-shadow;
    min-width: 200px;
    padding: 8px;
    border: $border-width-thin solid $color-border;
    border-radius: $border-radius-modals;
    background: $color-background;
    color: $color-dark;

    [data-slot='group'] { padding: 0; }

    [data-slot='item'] {
        @extend %style-context-menu-item;
        align-items: center;
        min-height: 44px;
        padding: 6px 8px;
        gap: 10px;
        border-radius: $border-radius;
        color: inherit;
        cursor: pointer;

        &::before { content: none; }

        &[data-highlighted],
        &:active {
            background: $color-primary;
            color: $color-primary-contrast;
        }
    }

    .iconify {
        width: 20px;
        height: 20px;
        color: inherit;
    }

    @media (prefers-reduced-motion: reduce) { animation: none; }
}

html.dark .site-color-mode-select:focus {
    border-color: $color-primary-dark;
    outline-color: $color-primary-dark;
}
</style>
