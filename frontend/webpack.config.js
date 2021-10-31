/* eslint-disable no-constant-condition */
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
//var FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin'); // no 5 support atm
// const CircularDependencyPlugin = require('circular-dependency-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const PreloadWebpackPlugin = require('@vue/preload-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const autoprefixer = require('autoprefixer');
const webpack = require("webpack")
const fs = require("fs")
const path = require("path")


const use_env = {}

// This is a debug config as a replacement for process.env.NODE_ENV which seems to break webpack 5
// process.env.BUILD_FOR_PRODUCTION

if (process.env.NODE_ENV === "production") {
    console.log("Building for production...")
}

if (process.env.LOAD_ENV) {
    // Load this in the environment
    const decode = JSON.parse(process.env.LOAD_ENV);

    // We restringify to make sure encoding is minified
    use_env["STAMHOOFD"] = JSON.stringify(decode);
    use_env["process.env.NODE_ENV"] = JSON.stringify(decode.environment === "production" ? "production" : "development")
} else if (process.env.ENV_FILE) {
    // Reading environment from a JSON env file (JSON is needed)
    const file = path.resolve(process.env.ENV_FILE)

    // Load this in the environment
    const contents = fs.readFileSync(file)
    const decode = JSON.parse(contents);
    const node_env = JSON.stringify(decode.environment === "production" ? "production" : "development")

    console.log("Using environment file: "+file)

    const stamhoofdEnv = JSON.stringify(decode)

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["STAMHOOFD"] = webpack.DefinePlugin.runtimeValue(() => stamhoofdEnv, {
        fileDependencies: [file],
    });

    // use runtimeValue, because cache can be optimized if webpack knows which cache to get
    use_env["process.env.NODE_ENV"] = node_env

} else {
    throw new Error("ENV_FILE or LOAD_ENV environment variables are missing")
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
        filename: process.env.NODE_ENV === "production" ? '[name].[contenthash].js' : '[name].[contenthash].js',
        chunkFilename: process.env.NODE_ENV === "production" ? '[name].[contenthash].js' : '[name].[contenthash].js',
        globalObject: 'this', // needed for webworkers
        //pathinfo: process.env.NODE_ENV === "production" ? true : false,
        assetModuleFilename: process.env.NODE_ENV === "production" ? 'images/[name].[contenthash][ext][query]' : 'images/[name].[contenthash][ext][query]'
    },
    devServer: {
        contentBase: './dist',
        host: '0.0.0.0',
        port: 8080,
        sockPort: 443, // needed because the dev server runs behind a reverse proxy (Caddy)
        disableHostCheck: true,
        historyApiFallback: true,
    },
    /*optimization: (process.env.NODE_ENV === "production" ? {} : {
        runtimeChunk: true,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        //splitChunks: false,
    }),*/
    devtool: "eval",
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader'
            },
            { 
                test: /\.tsx?$/, 
                use: [
                    ...(process.env.NODE_ENV === "production" ? [{
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
                                        // "debug": true, // If you enable, in the debug output, at the top, it will list the used browsers
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
                            transpileOnly: process.env.NODE_ENV !== "production" || true,
                            happyPackMode: process.env.NODE_ENV !== "production" || true,
                        },
                    }
                ]
            },
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
                test: /\.scss$/,
                exclude: /\.url.scss$/,
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
                            postcssOptions: {
                                plugins: [
                                    // Don't need icons here
                                    "autoprefixer"
                                ]
                            }
                            /*postcssOptions: (loader) => {
                                return { 
                                    plugins: [
                                        // Add the plugin
                                        //new IconfontWebpackPlugin(loader),
                                        autoprefixer
                                    ]
                                }
                            }*/
                        }
                    },
                    'sass-loader',
                ]
            },
            {
                test: /\.url.scss$/,
                use: [
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
                            postcssOptions: {
                                plugins: [
                                    // Don't need icons here
                                    "autoprefixer"
                                ]
                            }
                        }
                    },
                    'sass-loader',
                ]
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
                generator: {
                    filename: process.env.NODE_ENV === "production" ? 'images/[name].[contenthash][ext]' : 'images/[name].[contenthash][ext]',
                }
            },
            {
                test: /\.(woff2?)$/i,
                type: 'asset/resource',
                generator: {
                    filename: process.env.NODE_ENV === "production" ? 'fonts/[name].[contenthash][ext]' : 'fonts/[name].[contenthash][ext]',
                }
            },
            {
                test: /\.font\.js/,
                use: [
                    process.env.NODE_ENV === "production" ? MiniCssExtractPlugin.loader : 'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            url: false
                        }
                    },
                    {
                        loader: '@simonbackx/webfonts-loader',
                        //options: { ... }
                    }
                ]
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
        ...(process.env.NODE_ENV === "production" && false) ? [] : [new ForkTsCheckerWebpackPlugin(
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
            include: 'initial',
            // Only preload woff2 fonts, because modern browsers only need that font
            fileWhitelist: [/\.woff2/]
        }),

        new CopyPlugin({
            patterns: [
                { from: "../../public/.well-known" },
                { from: "../../public/out-of-date.html" },
                { from: "../../public/robots.txt" },
            ],
        }),
    ],
    experiments: {
        //syncWebAssembly: true // temporary, until fixed
        asyncWebAssembly: true
    },
    //cache: false,
    /*cache: {
        type: 'filesystem',
        //allowCollectingMemory: true,
        buildDependencies: {
            // This makes all dependencies of this file - build dependencies
            config: [__filename],
            // By default webpack and loaders are build dependencies
        },
    },*/
    snapshot: {
        managedPaths: [
            path.resolve(__dirname, '../node_modules')
        ],
    }
};
