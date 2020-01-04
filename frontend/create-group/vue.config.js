// vue.config.js
const path = require('path');
module.exports = {
  css: {
    loaderOptions: {
      scss: {
        /// This auto prepends the variable imports to all SCSS. So we can use the variables from everywhere.
        /// In SCSS we need to use ~ + alias to use an alias name. 
        prependData: `@use "~@shared/scss/base/variables.scss" as *;`
      }
    }
  },
  configureWebpack: {
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, '../shared/')
      }
    }
  }
}