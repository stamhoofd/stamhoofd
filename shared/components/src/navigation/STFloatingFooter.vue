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
    padding: 10px 0;
}
</style>
