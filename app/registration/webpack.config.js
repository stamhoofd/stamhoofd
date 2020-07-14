const path = require("path");
var merge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
var common = require("../../webpack.config.js");

module.exports = merge(common, {
    target: 'web',
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
    },
    devServer: {
        port: 8081,
        sockPort: 443 // needed because the dev server runs behind a reverse proxy (Caddy)
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html'
        })
    ],
});
