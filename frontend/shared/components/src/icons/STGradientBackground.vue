<template>
    <div class="st-gradient-background">
        <div class="pattern">
            <svg width="1512" height="779" viewBox="0 0 1512 779" fill="none" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                <path d="M448.918 114.43L435.971 131.754C370.52 219.333 248.695 241.796 156.313 183.319C106.23 151.617 50.6545 144.236 0 155.443V779H1512V0H1126.02L1125.43 0.669208C1038.73 97.8919 897.599 124.884 781.144 66.5148L739.604 45.6948C638.848 -4.80535 516.386 24.1519 448.918 114.43Z" fill="url(#paint0_linear_43_2205)" />
                <defs>
                    <linearGradient id="paint0_linear_43_2205" x1="756" y1="0" x2="756" y2="779" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0053FF" />
                        <stop offset="1" stop-color="#0053FF" stop-opacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            <div class="fill-remaining" />
        </div>
    </div>
</template>


<style lang="scss">
@use '@stamhoofd/scss/base/variables' as *;

.st-gradient-background {
    pointer-events: none;
    position: absolute;
    height: 1000px;
    width: 100%;
    z-index: 0;

    background: linear-gradient(180deg, rgba($color-primary-original, 0.1), rgba($color-primary-original, 0) 100%);

    .pattern {
        display: grid;
        grid-template-columns: auto 1fr;
        opacity: 0.03;

        svg {
            max-width: 100%;
            height: auto;
        }

        > .fill-remaining {
            background: linear-gradient(180deg, $color-primary-original 0%, rgba($color-primary-original, 0) 100%);
        }
    }
}

</style>