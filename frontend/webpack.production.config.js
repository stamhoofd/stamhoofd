
// Before we load common, we set production to true, because we'll get a different config
//process.env.NODE_ENV = "production";
process.env.BUILD_FOR_PRODUCTION = true;

var common = require("./webpack.config.js");
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
var { merge } = require('webpack-merge');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = merge(common, {
    mode: "production",
    optimization: {
        minimize: true,
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
            new CssMinimizerPlugin(),
            new TerserPlugin({
                //sourceMap: true,
                extractComments: false,
                terserOptions: {
                    ecma: "2015",
                    safari10: true,
                    sourceMap: true,
                    output: {
                        comments: false,
                    },
                },
            }),
        ]
    },
    performance: {
        hints: 'warning',
        maxEntrypointSize: 250000,
        maxAssetSize: 250000
    },
    /*plugins: [
        new BundleAnalyzerPlugin()
    ]*/
});
