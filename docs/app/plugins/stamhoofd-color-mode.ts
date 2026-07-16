// Docus drives dark mode through @nuxtjs/color-mode, which sets .dark / .light on
// <html>. @stamhoofd/scss keys off body.dark / body.light instead, so mirror the
// resolved color mode onto <body>.
export default defineNuxtPlugin(() => {
    const colorMode = useColorMode();

    useHead({
        bodyAttrs: {
            class: computed(() => (colorMode.value === 'dark' ? 'dark' : 'light')),
        },
    });
});
