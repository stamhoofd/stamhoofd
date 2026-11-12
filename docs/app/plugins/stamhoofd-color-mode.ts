// Shared app styles use unclassified body for Auto and body.light/body.dark for
// explicit preferences. Keep those classes out of SSR head merging: the system
// preference and persisted overrides are only known in the browser.
export default defineNuxtPlugin(() => {
    const colorMode = useColorMode();

    if (import.meta.client) {
        watch(() => [colorMode.preference, colorMode.value, colorMode.forced], () => {
            const forcedMode = colorMode.forced ? colorMode.value : colorMode.preference;
            document.body.classList.toggle('light', forcedMode === 'light');
            document.body.classList.toggle('dark', forcedMode === 'dark');
        }, { immediate: true });
    }
});
