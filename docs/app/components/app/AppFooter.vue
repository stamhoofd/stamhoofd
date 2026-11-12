<template>
    <footer class="site-footer">
        <nav class="site-footer-links" aria-label="Voetnavigatie">
            <a href="https://feedback.stamhoofd.app" class="site-action">
                <span class="icon feedback-line" aria-hidden="true" />
                Feedback en ideeën
            </a>
            <a href="https://www.stamhoofd.be/changelog" class="site-action">
                <span class="icon gift" aria-hidden="true" />
                Nieuw
            </a>
            <NuxtLink to="/" class="site-action">
                <span class="icon book" aria-hidden="true" />
                Documentatie
            </NuxtLink>
            <a href="mailto:hallo@stamhoofd.be" class="site-action">
                <span class="icon email" aria-hidden="true" />
                Contact
            </a>
            <a href="https://www.stamhoofd.be" class="site-action">
                <span class="icon external" aria-hidden="true" />
                Hoofdwebsite
            </a>
        </nav>
        <div class="site-footer-copy">
            <SiteColorModeSelect class="site-footer-color-mode" />
            <p>© {{ year }}, Codawood BV, BE0747.832.683</p>
        </div>
    </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear();
</script>
