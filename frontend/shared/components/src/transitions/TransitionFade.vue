<template>
    <Transition name="fade" mode="out-in">
        <slot/>
    </Transition>
</template>

<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease !important;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0 !important;
}

.no-label {
    grid-column: span 2;
}
</style>
