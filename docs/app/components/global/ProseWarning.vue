<!-- Overrides @nuxt/ui's ::warning callout. Must stay in components/global/: MDC resolves
     components at runtime and only sees globally registered ones. -->
<template>
    <div class="warning-box">
        <slot mdc-unwrap="p" />
    </div>
</template>
