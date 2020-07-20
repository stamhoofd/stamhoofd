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
    margin-top: auto;
    padding-top: 15px;
    position: sticky;
    bottom: 0;
    

    >div {
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }

    > div > * {
        margin-top: 15px;

        &:first-child {
            margin-top: 0;;
        }
    }
}
</style>
