const path = require('path');

module.exports = {
    entry: './src/sdk/PaymentGateway.js',
    output: {
        filename: 'checkout.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'PaymentGateway',
            type: 'umd',
            export: 'default'
        },
        globalObject: 'this'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ]
    },
    mode: 'production'
};
