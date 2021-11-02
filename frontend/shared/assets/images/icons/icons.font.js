
module.exports = {
  'files': [
    '*.svg'
  ],
  'fontName': 'icons',
  'classPrefix': 'icon.',
  'baseSelector': '.icon',
  'types': ['woff2', 'woff'],
  'fileName': 'icons.[hash].[ext]',
  'cssTemplate': "./iconCss.hbs",
  "cssContext": function(ctx, options, handlebars) {
    // Move specific icons in a separate variable
    ctx.box_icons = {}
    for (const icon in ctx.codepoints) {
      if (["error", "info", "warning", "success"].includes(icon)) {
        ctx.box_icons[icon] = ctx.codepoints[icon]
      }
    }
  }
};