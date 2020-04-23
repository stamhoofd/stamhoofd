const path = require("path");
var merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
var common = require("../../../webpack.config.js");

module.exports = merge(common, {
    entry: {
        login: "./src/login.ts",
        dashboard: "./src/index.ts"
    },
    output: {
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new HtmlWebpackPlugin({
            chunks: ['login'],
            filename: "login.html",
            template: './src/index.html'
        }),
        new HtmlWebpackPlugin({
            chunks: ['dashboard'],
            template: './src/index.html'
        })
    ]
});
