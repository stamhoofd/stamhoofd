const path = require("path");
var merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
var common = require("../../webpack.config.js");

module.exports = merge(common, {
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html'
        })
    ]
});
