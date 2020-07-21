<template>
    <div class="st-floating-footer">
        <div>
            <slot />
        </div>
    </div>
</template>

<style lang="scss">
@use "~@stamhoofd/scss/base/variables.scss" as *;
@use '~@stamhoofd/scss/base/text-styles.scss';

.st-floating-footer {
    margin: 0 calc(-1 * var(--st-horizontal-padding, 40px));
    margin-bottom: calc(-1 * var(--st-vertical-padding, 40px));
    margin-top: auto;
    padding-top: 15px;
    position: sticky;
    bottom: 0;
    
    >div {
        padding: 0 var(--st-horizontal-padding, 40px);
        padding-bottom: var(--st-vertical-padding, 40px);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        overflow: hidden;
    }

    > div > * {
        margin-top: 15px;

        &:first-child {
            margin-top: 0;;
        }
    }
}
</style>
