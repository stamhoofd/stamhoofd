<!-- Overrides @nuxt/ui's ::tip callout. Must stay in components/global/: MDC resolves
     components at runtime and only sees globally registered ones. -->
<template>
    <div class="success-box">
        <slot mdc-unwrap="p" />
    </div>
</template>
