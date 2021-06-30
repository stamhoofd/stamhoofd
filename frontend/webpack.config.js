/* eslint-disable no-constant-condition */
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
//var FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin'); // no 5 support atm
const IconfontWebpackPlugin = require('iconfont-webpack-plugin');
// const CircularDependencyPlugin = require('circular-dependency-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const PreloadWebpackPlugin = require('@vue/preload-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const autoprefixer = require('autoprefixer');
const webpack = require("webpack")
require('dotenv').config({path: __dirname+'/.env'})

const use_env = {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || "development"),
}

// This is a debug config as a replacement for process.env.NODE_ENV which seems to break webpack 5
// process.env.BUILD_FOR_PRODUCTION

if (process.env.NODE_ENV === "production") {
    console.log("Building for production...")
}

if (process.env.LOAD_ENV) {
    // Load this in the environment
    const decode = JSON.parse(process.env.LOAD_ENV);
    for (const key in decode) {
        const val = decode[key];
        use_env["process.env."+key] = JSON.stringify(val);
    }
} else {
    // Use current environment
    if (process.env.NODE_ENV === "production") {
        //throw new Error("Setting LOAD_ENV is required for non development environments")
        console.log("Setting LOAD_ENV is required for non development environments")
    }

    for (const key in process.env) {
        const val = process.env[key];
        use_env["process.env."+key] = JSON.stringify(val);
    }
}

module.exports = {
    mode: "development",
    target: 'web',
    stats: 'minimal',
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension (so that you don't have to add it explicitly)
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            vue$: "vue/dist/vue.runtime.esm.js", // we only need vue runtime, no compilation
            // ...
        },

        // Needed for libsodium
        // It automatically detects if node is used or not, so stop webpack from complaining about this:
        fallback: { 
            "path": false,
            "crypto": false,
            "stream": false,
        }
    },
    output: {
        publicPath: "/",
        filename: process.env.NODE_ENV === "production" ? '[name].[contenthash].js' : '[name].[fullhash].js',
        chunkFilename: process.env.NODE_ENV === "production" ? '[name].[contenthash].js' : '[name].[fullhash].js',
        globalObject: 'this' // needed for webworkers
    },
    devServer: {
        contentBase: './dist',
        host: '0.0.0.0',
        port: 8080,
        sockPort: 443, // needed because the dev server runs behind a reverse proxy (Caddy)
        disableHostCheck: true,
        historyApiFallback: true,
    },
    devtool: "eval",
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
                    ...(process.env.NODE_ENV === "production" || true ? [{
                        loader: 'babel-loader',
                        options: {
                            babelrc: false,
                            presets: [
                                [
                                   "@babel/preset-env",
                                    {		
                                        "useBuiltIns": "usage",		
                                        "corejs": { 
                                            version: "3.15", 
                                            proposals: true // Somehow this is needed to make string.replaceAll work, don't know why that is a 'proposal'.
                                        },
                                        "bugfixes": true, // Makes bundle size a bit smaller
                                        "debug": true,
                                        "shippedProposals": true // Also include proposals that are shipped in browsers for a while (such as replcaeAll)
                                    }
                                ]
                            ]
                        }
                    }] : []),
                    {
                        loader: 'ts-loader',
                        options: { 
                            appendTsSuffixTo: [/\.vue$/],
                            transpileOnly: process.env.NODE_ENV !== "production",
                            happyPackMode: process.env.NODE_ENV !== "production",
                        },
                    }
                ]
            },
            /*{ 
                // commented out, since this causes memory issues in webpack
                test: /\.jsx?$/, 
                exclude: /node_modules\/@zxcvbn-ts/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            babelrc: false,
                            presets: [
                                [
                                   "@babel/preset-env",
                                    {		
                                        "useBuiltIns": "usage",		
                                        "corejs": "3.8",
                                        "bugfixes": true // Makes bundle size a bit smaller
                                    }
                                ]
                            ],
                            plugins: [
                                // for iOS 10 + iOS 11
                                "@babel/plugin-proposal-object-rest-spread"
                            ]

                            // Remove for modern build:
                            //"plugins": [		
                            //    "@babel/plugin-transform-regenerator"		
                            //]
                        }
                    }
                ]
            },*/
            {
                test: /\.css$/,
                use: [
                    process.env.NODE_ENV === "production" ? MiniCssExtractPlugin.loader : 'style-loader', 
                    // If you enable this, HMR won't work. Replace it with a style loader
                    // sets the style inline, instead of using MiniCssExtractPlugin.loader
                    'css-loader',
                    { 
                        loader: 'postcss-loader', 
                        options: {
                            postcssOptions: {
                                plugins: [
                                    // Don't need icons here
                                    "autoprefixer"
                                ]
                            }
                        }
                    }
                ],
            },
            // this will apply to both plain `.css` files
            // AND `<style>` blocks in `.vue` files
            {
                test: /\.url.scss$/,
                use: [
                    {
                        loader: "css-loader",
                        options: {
                            importLoaders: 2,
                            // 0 => no loaders (default);
                            // 1 => postcss-loader;
                            // 2 => postcss-loader, sass-loader
                        },
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: (loader) => {
                                return { 
                                    plugins: [
                                        // Add the plugin
                                        new IconfontWebpackPlugin(loader),
                                        autoprefixer
                                    ]
                                }
                            }
                        }
                    },
                    'sass-loader',
                ]
            },
            // this will apply to both plain `.css` files
            // AND `<style>` blocks in `.vue` files
            {
                test: /\.scss$/,
                exclude:  /\.url.scss$/,
                use: [
                    process.env.NODE_ENV === "production" ? MiniCssExtractPlugin.loader : 'style-loader',  // vue-style-loader is not supported/maintained any longer and doesn't work without other changes
                    // If you enable this, HMR won't work. Replace it with a style loader
                    // sets the style inline, instead of using MiniCssExtractPlugin.loader
                    {
                        loader: "css-loader",
                        options: {
                            importLoaders: 2
                            // 0 => no loaders (default);
                            // 1 => postcss-loader;
                            // 2 => postcss-loader, sass-loader
                        },
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: (loader) => {
                                return { 
                                    plugins: [
                                        // Add the plugin
                                        new IconfontWebpackPlugin(loader),
                                        autoprefixer
                                    ]
                                }
                            }
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
                            name: 'images/[name].[contenthash].[ext]',
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
                            name: 'fonts/[name].[contenthash].[ext]',
                            esModule: false // Important to work with vue
                        },
                    },
                ],
            }
        ],
    },
    plugins: [
        // make sure to include the plugin!
        //new FriendlyErrorsWebpackPlugin(),
        new CleanWebpackPlugin(), // Clear the dist folder before building
        new VueLoaderPlugin(), // Allow .vue files
        ...(process.env.NODE_ENV !== "production") ? [] : [new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
            //chunkFilename: '[id].[contenthash].css',
            ignoreOrder: false, // Enable to remove warnings about conflicting order
        })],
        new webpack.DefinePlugin(use_env),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        /*new CircularDependencyPlugin({
            exclude: /\/shared\/components\//,
            // add errors to webpack instead of warnings
            failOnError: true,
        })*/
        ...(process.env.NODE_ENV === "production") ? [] : [new ForkTsCheckerWebpackPlugin(
            {
                typescript: {
                    enabled: true,
                    extensions: {
                        vue: {
                            enabled: true,
                        }
                    },
                    diagnosticOptions: {
                        semantic: true,
                        syntactic: true,
                    }
                },
            }
        )],

        new PreloadWebpackPlugin({
            rel: 'preload',
            as: 'font',
            include: 'all',
            fileWhitelist: [/\.woff2/]
        }),

        new CopyPlugin({
            patterns: [
                { from: "../../public/out-of-date.html" },
                { from: "../../public/robots.txt" },
            ],
        }),
    ],
    experiments: {
        syncWebAssembly: true // temporary, until fixed
    },
};
