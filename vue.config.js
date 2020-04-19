// vue.config.js
const path = require("path");

throw new Error("Not used anymore");
module.exports = {
    css: {
        loaderOptions: {
            scss: {
                /// This auto prepends the variable imports to all SCSS. So we can use the variables from everywhere.
                /// In SCSS we need to use ~ + alias to use an alias name.
                prependData: `@use "scss/base/variables.scss" as *;`
            }
        }
    },
    configureWebpack: {
        resolve: {
            alias: {
                "shared": path.resolve(__dirname, 'src/shared/'),
                "scss": path.resolve(__dirname, 'scss/'),
                "assets": path.resolve(__dirname, 'assets/')
            }
        },
        output: {
            filename: "[name].[hash].js"
        },
        // Remove for production
        devtool: "source-map"
    },
    publicPath: "",
    pages: {
        index: {
          entry: 'src/organizations/main.ts',
          template: 'src/organizations/public/electron.html',
          filename: 'index.html',
        },
    },
    // Fix external eslint config missing
    chainWebpack: config => {
        config.module
            .rule("eslint")
            .use("eslint-loader")
            .tap(options => {
                options.configFile = path.resolve(__dirname, ".eslintrc.js");
                return options;
            });
    }
};
