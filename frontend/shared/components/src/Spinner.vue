<template>
    <div class="spinner-container">
        <div class="spinner">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" stroke="#0053FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        </div>
    </div>
</template>

<style lang="scss">
@use '~@stamhoofd/scss/base/variables' as *;

.spinner-container  > div.spinner {
    display: inline-block;
    animation: spinner-spin 2s linear infinite;
    width: 28px;
    height: 28px;
    overflow: hidden;

    > svg {
        width: 28px;
        height: 28px;
        display: block;
        animation: spinner-spin 2s infinite;
        overflow: hidden;
        
        > circle {
            stroke: $color-primary;
            stroke: var(--color-primary, $color-primary);
            animation: spinner-circle 4s infinite;
        }
    }
}

.spinner-container {
    &.center {
        width: 100%;
        text-align: center;
    }
    &.gray {
        div.spinner > svg > circle {
            stroke: $color-gray;
        }
    }
}

@keyframes spinner-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@keyframes spinner-circle {
    0% { stroke-dasharray: 15 100; }
    50% { stroke-dasharray: 40 100; }
    100% { stroke-dasharray: 15 100; }
}

@keyframes spinner-end {
    to { stroke-dasharray: 0 100; }
}
</style>