const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
var FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const IconfontWebpackPlugin = require('@simonbackx/iconfont-webpack-plugin');
const autoprefixer = require('autoprefixer');
const path = require("path");

module.exports = {
    mode: "development",
    stats: 'none',
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension (so that you don't have to add it explicitly)
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            vue$: "vue/dist/vue.runtime.esm.js", // we only need vue runtime, no compilation
            // ...
        }
    },
    output: {
        filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash].js' : '[name].[hash].js',
        chunkFilename: process.env.NODE_ENV === 'production' ? '[name].[contenthash].js' : '[name].[hash].js',
        globalObject: 'this' // needed for webworkers
    },
    devServer: {
        contentBase: './dist',
        allowedHosts: [
            '.stamhoofd.be',
            '.stamhoofd.local',
        ],
        // To test on external devices
        host: '0.0.0.0',//your ip address
        port: 8080,
        sockPort: 443, // needed because the dev server runs behind a reverse proxy (Caddy)
        disableHostCheck: true,
        historyApiFallback: true
    },
    devtool: "sourcemap",
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            {
                test: /\.worker\.ts$/,
                loader: 'worker-loader',
            },
            { 
                test: /\.tsx?$/, 
                use: [
                    {
                        loader: 'babel-loader',
                    },
                    {
                        loader: 'ts-loader',
                        options: { appendTsSuffixTo: [/\.vue$/] },
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    process.env.NODE_ENV === 'production' ? 
                        { 
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                                esModule: true,
                            },
                        
                        } : // If you enable this, HMR won't work. Replace it with a style loader
                        'style-loader', // sets the style inline, instead of using MiniCssExtractPlugin.loader
                    'css-loader',
                    { 
                        loader: 'postcss-loader', 
                        options: {
                            "plugins": [autoprefixer]
                        }
                    }
                ],
            },
            // this will apply to both plain `.css` files
            // AND `<style>` blocks in `.vue` files
            {
                test: /\.scss$/,
                use: [
                    process.env.NODE_ENV === 'production' ? 
                        { 
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                                esModule: true,
                            },
                        
                        } : // If you enable this, HMR won't work. Replace it with a style loader
                        'vue-style-loader', // sets the style inline, instead of using MiniCssExtractPlugin.loader
                    'css-loader',
                    {
                        loader: 'postcss-loader',
                        options: {
                            plugins: (loader) => [
                                // Add the plugin
                                new IconfontWebpackPlugin(loader),
                                autoprefixer
                            ]
                        }
                    },
                    'sass-loader',
                ]
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'images/[name].[hash].[ext]',
                            esModule: false // Important to work with vue
                        },
                    },
                ],
            },
            {
                test: /\.(woff2?)$/i,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'fonts/[name].[hash].[ext]',
                            esModule: false // Important to work with vue
                        },
                    },
                ],
            }
        ],
    },
    plugins: [
        // make sure to include the plugin!
        new FriendlyErrorsWebpackPlugin(),
        new CleanWebpackPlugin(), // Clear the dist folder before building
        new VueLoaderPlugin(), // Allow .vue files
        ...(process.env.NODE_ENV !== 'production') ? [] : [new MiniCssExtractPlugin({ // Make sure CSS is not put inline, but saved to a seperate file
            filename: '[name].[contenthash].css',
            //chunkFilename: '[id].[contenthash].css',
        })]
    ]
};
