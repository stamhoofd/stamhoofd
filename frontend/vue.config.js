// vue.config.js
const path = require("path");
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
                "@shared": path.resolve(__dirname, 'src/shared/'),
                "stamhoofd-shared": path.resolve(__dirname, 'src/shared/'),
                "create-group": path.resolve(__dirname, 'src/create-group/'),
                "scss": path.resolve(__dirname, 'scss/'),
                "public": path.resolve(__dirname, 'public/'),
                "assets": path.resolve(__dirname, 'assets/')
            }
        },
        output: {
            filename: "[name].[hash].js"
        },
        // Remove for production
        devtool: "source-map"
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
