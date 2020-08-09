
// Before we load common, we set production to true, because we'll get a different config
process.env.NODE_ENV = "production";

var common = require("./webpack.config.js");
const CssnanoPlugin = require('cssnano-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
var merge = require('webpack-merge');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = merge(common, {
    mode: "production",
    optimization: {
        minimize: true,
        usedExports: true,
        splitChunks: {
            chunks: 'all',
            minChunks: 2,
            cacheGroups: {
                styles: {
                    name: 'styles',
                    test: /\.css$/,
                    chunks: 'all',
                    enforce: true,
                },
            },
        },
        minimizer: [
            new CssnanoPlugin(),
            new TerserPlugin({
                sourceMap: true,
                extractComments: false,
                terserOptions: {
                    ecma: "2015",
                    safari10: true,
                    output: {
                        comments: false,
                    },
                },
            }),
        ]
    }
});
