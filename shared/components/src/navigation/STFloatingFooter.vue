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
    padding: 20px 0;
    padding-bottom: var(--st-vertical-padding, 20px);
}
</style>
