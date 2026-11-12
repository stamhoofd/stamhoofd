<template>
    <header class="site-header" :class="{ 'site-header-home': route.path === '/' }">
        <div class="site-header-background" aria-hidden="true" />
        <div class="site-header-bar">
            <NuxtLink to="/" class="site-logo" aria-label="Stamhoofd Documentatie — startpagina">
                <span class="site-logo-image">
                    <img class="site-logo-light" src="/logo-horizontal.svg" alt="" width="146" height="27">
                    <img class="site-logo-dark" src="/logo-horizontal-dark.svg" alt="" width="146" height="27">
                </span>
                <span class="site-logo-label">Documentatie</span>
            </NuxtLink>
            <nav class="site-header-actions" aria-label="Hoofdnavigatie">
                <button type="button" class="site-action" aria-label="Zoeken" @click="searchOpen = true">
                    <span class="icon search" aria-hidden="true" />
                    <span>Zoeken</span>
                </button>
                <a class="site-action" href="https://www.stamhoofd.be" aria-label="Terug naar website">
                    <span class="icon external" aria-hidden="true" />
                    <span>Terug naar website</span>
                </a>
            </nav>
        </div>
    </header>
</template>

<script setup lang="ts">
const route = useRoute();
const { open: searchOpen } = useContentSearch();

watch(() => route.fullPath, () => {
    searchOpen.value = false;
});
</script>
