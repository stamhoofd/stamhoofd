const path = require("path");
var { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')

var common;
if (process.env.NODE_ENV == "production") {
    common = require("../../webpack.production.config.js");
} else {
    common = require("../../webpack.config.js");
}
module.exports = merge(common, {
    target: 'web',
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            base: "/"
        }),
        ...(process.env.NODE_ENV !== "production") ? [] : [new FaviconsWebpackPlugin({
            logo: './../../shared/assets/images/logo/favicon.svg',
            mode: 'webapp', // optional can be 'webapp' or 'light' - 'webapp' by default
            devMode: 'webapp', // optional can be 'webapp' or 'light' - 'light' by default 
            favicons: {
                //theme_color: '#0053ff',
            }
        })]
    ],
});
