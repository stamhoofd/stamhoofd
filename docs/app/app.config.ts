export default defineAppConfig({
    icon: {
        // App SVG sources use a fixed ink color; UI icons must inherit theme colors.
        customize: (content: string) => content.replaceAll('#000716', 'currentColor').replaceAll('fill="black"', 'fill="currentColor"'),
    },
    docus: {
        locale: 'nl',
        shortcuts: {
            toggleColorMode: '',
        },
    },
    seo: {
        title: 'Stamhoofd Documentatie',
        titleTemplate: '%s - Stamhoofd Documentatie',
    },
    header: {
        title: 'Stamhoofd Documentatie',
        logo: {
            alt: 'Stamhoofd',
            light: '/logo-horizontal.svg',
            dark: '/logo-horizontal-dark.svg',
            favicon: '/favicon.svg',
        },
    },
    ui: {
        icons: {
            search: 'stamhoofd:search',
            file: 'stamhoofd:file',
            hash: 'stamhoofd:paragraph',
            close: 'stamhoofd:close',
            check: 'stamhoofd:success',
            arrowLeft: 'stamhoofd:arrow-left',
            chevronRight: 'stamhoofd:arrow-right-small',
        },
        contentSearch: {
            defaultVariants: {
                placeholder: 'Zoek in de documentatie…',
            },
            slots: {
                modal: 'site-search-popup motion-reduce:animate-none!',
            },
        },
        commandPalette: {
            slots: {
                item: 'items-start py-3',
                itemLabel: 'grid gap-1 space-x-0 overflow-visible whitespace-normal text-clip',
                itemLabelBase: 'row-start-1 line-clamp-2 font-semibold whitespace-normal',
                itemLabelPrefix: 'row-start-2 line-clamp-2 text-xs whitespace-normal',
                itemLabelSuffix: 'row-start-3 line-clamp-3 whitespace-normal',
                itemDescription: 'line-clamp-3 whitespace-normal',
            },
        },
        prose: {
            pre: {
                slots: {
                    // Match the surfaces used by the GitHub Shiki themes.
                    base: 'bg-white dark:bg-[#0d1117]',
                },
            },
        },
        colors: {
            primary: 'blue',
            neutral: 'neutral',
        },
    },
    github: false,
});
