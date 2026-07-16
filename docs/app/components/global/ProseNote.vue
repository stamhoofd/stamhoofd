<!-- Overrides @nuxt/ui's ::note callout. Must stay in components/global/: MDC resolves
     components at runtime and only sees globally registered ones. -->
<template>
    <div class="info-box">
        <slot mdc-unwrap="p" />
    </div>
</template>
