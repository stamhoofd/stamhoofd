const path = require("path");
var merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
var common = require("../../../webpack.config.js");
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = merge(common, {
    target: 'electron-renderer',
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
        }),
        new webpack.DefinePlugin({
            'process.env.IS_ELECTRON': JSON.stringify(true),
        })
    ],
    // Prevent bundling node modules, because we are using electron anyway...
    externals: [nodeExternals({
        modulesDir: path.resolve(__dirname, '../../../node_modules'),
        whitelist: [ /^@stamhoofd/]
    })],
});
