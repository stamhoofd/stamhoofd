module.exports = {
    files: [
        '*.svg',
    ],
    fontName: 'st-icons',
    classPrefix: 'icon.',
    baseSelector: '.icon',
    types: ['woff2', 'woff'],
    fileName: 'icons.[hash].[ext]',
    cssTemplate: './iconCss.hbs',
    cssFontsUrl: '/', // this is required to resolve the correct css path in case we are not on the root url
    cssContext: function (ctx, options, handlebars) {
    // Move specific icons in a separate variable
        ctx.box_icons = {};
        for (const icon in ctx.codepoints) {
            if (['error', 'info', 'warning', 'success'].includes(icon)) {
                ctx.box_icons[icon] = ctx.codepoints[icon];
            }
        }

        // Custom android icons
        ctx.android_icons = {};
        for (const icon in ctx.codepoints) {
            if (icon.endsWith('-android')) {
                // Remove android suffix
                ctx.android_icons[icon.substr(0, icon.length - ('-android'.length))] = ctx.codepoints[icon];
            }
        }

        // Custom iOS icons
        ctx.ios_icons = {};
        for (const icon in ctx.codepoints) {
            if (icon.endsWith('-ios')) {
                // Remove android suffix
                ctx.ios_icons[icon.substr(0, icon.length - ('-ios'.length))] = ctx.codepoints[icon];
            }
        }

        // Custom Apple icons
        ctx.apple_icons = {};
        for (const icon in ctx.codepoints) {
            if (icon.endsWith('-apple')) {
                // Remove android suffix
                ctx.apple_icons[icon.substr(0, icon.length - ('-apple'.length))] = ctx.codepoints[icon];
            }
        }
    },
};
