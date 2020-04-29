const path = require("path");
var merge = require('webpack-merge');
var common = require("../../../webpack.config.js");
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = merge(common, {
    mode: 'development',
    target: 'electron-main',
    entry: {
        index: "./src/electron.ts"
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: '[name].js',
    },
    plugins: [
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
