<template>
    <div class="st-floating-footer">
        <div>
            <slot />
        </div>
    </div>
</template>

<style lang="scss">

.st-floating-footer {
    margin: 0;
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    margin-top: auto;
    padding-top: 15px;
    position: sticky;
    bottom: 0;

    &.no-sticky {
        position: static;
    }
    
    >div {
        padding: 0 var(--st-horizontal-padding, 40px);

        padding-top: 15px;
        padding-bottom: var(--st-vertical-padding, 40px);
        --default-footer-padding: var(--st-vertical-padding, 40px);

        display: flex;
        flex-direction: column;
        align-items: stretch;
        overflow: hidden;
    }

    > div > * {
        margin-top: 10px;

        &:first-child {
            margin-top: 0;
        }
    }
}
</style>
