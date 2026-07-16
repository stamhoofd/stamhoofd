<!-- Overrides @nuxt/ui's ::caution callout. Must stay in components/global/: MDC resolves
     components at runtime and only sees globally registered ones. -->
<template>
    <div class="error-box">
        <slot mdc-unwrap="p" />
    </div>
</template>
