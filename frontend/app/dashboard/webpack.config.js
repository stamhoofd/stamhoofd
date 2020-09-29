const path = require("path");
var merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');

var common;
if (process.env.NODE_ENV != "production") {
    common = require("../../webpack.config.js");
} else {
    common = require("../../webpack.production.config.js");
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
        })
    ],
});
