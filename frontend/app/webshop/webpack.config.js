const path = require("path");
var { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');

var common;
if (process.env.NODE_ENV != "production") {
    common = require("../../webpack.config.js");
} else {
    common = require("../../webpack.production.config.js");
}

// We need two builds for the webshop:
// one for hosting on the domain root (all assets are on the root)
// and one for hosting in a directory, e.g. /shop/ (all assets are in a folder)
const use_prefix = process.env.USE_SHOP_PREFIX === "1"
const prefix = use_prefix ? "/shop" : "" // todo: read prefix from STAMHOOFD config

module.exports = merge(common, {
    target: 'web',
    entry: "./src/index.ts",
    output: {
        path: use_prefix ? path.resolve(__dirname, "dist-prefix") : path.resolve(__dirname, "dist"),
        publicPath: prefix+"/"
    },
    devServer: {
        port: prefix ? 8882 : 8082,
        sockPort: 443, // needed because the dev server runs behind a reverse proxy (Caddy)
        sockPath: prefix+'/sockjs-node',
        historyApiFallback: {
            index: prefix+'/index.html',
            disableDotRule: true, // default behaviour is to ignore all urls with a dot character. lol.
        },
    },
    plugins: [
        /// Default for shop.domain.com/uri
        new HtmlWebpackPlugin({
            template: './src/index.html',
        })
    ],
});
