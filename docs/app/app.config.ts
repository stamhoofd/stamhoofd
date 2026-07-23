export default defineAppConfig({
    header: {
        title: 'Stamhoofd',
        logo: {
            alt: 'Stamhoofd',
            light: '/logo-horizontal.svg',
            dark: '/logo-horizontal-dark.svg',
            favicon: '/favicon.svg',
        },
    },
    ui: {
        prose: {
            img: {
                slots: {
                    // Show the zoomed screenshot at its own size instead of
                    // stretching it to the viewport: upscaling makes it blurry.
                    zoomedImage: 'w-auto h-auto max-w-[95vw] max-h-[95vh] object-contain rounded-md',
                },
            },
        },
        colors: {
            primary: 'blue',
        },
    },
    github: false,
});
