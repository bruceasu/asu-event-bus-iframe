const webpack = require('webpack');
const path = require('path');

const config = {
    entry: {
        index: './src/index.js'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
    optimization: {
        minimize: true
    },
    //mode: 'development'
    mode: 'production'
};
module.exports = config;