// const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

const { ModuleFederationPlugin } = require('webpack').container;
const { WatchIgnorePlugin } = require('webpack')

require('@signalk/server-admin-ui-dependencies')

const packageJson = require('./package')

console.log(packageJson.name.replace(/[-@/]/g, '_'))

module.exports = {
  entry: './public_src/index',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'public'),
    umdNamedDefine: true
  },
  //externals: { 'react': 'react', 'react-dom' : 'reactDOM' },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: ['@babel/preset-react'],
        },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        loader:
          'file-loader',
        options: {
          name: '[path][name].[ext]',
        },
      }
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'pdjr-skplugin-alarm-manager',
      library: { type: 'var', name: packageJson.name.replace(/[-@/]/g, '_') },
      filename: 'remoteEntry.js',
      exposes: {
        './PluginConfigurationPanel': './public_src/components/PluginConfigurationPanel',
      },
      shared: [{ react: { singleton: true } }],
    }),
    new WatchIgnorePlugin({
      paths: [path.resolve(__dirname, 'public/')]
    })
    // new HtmlWebpackPlugin({
    //   template: './public/index.html',
    // }),
  ],
  resolve: {
    alias: {          
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),      
    }  
  },
  externals: {
    // Don't bundle react or react-dom      
    react: {          
      commonjs: "react",          
      commonjs2: "react",          
      amd: "React",          
      root: "React"      
    },      
    "react-dom": {          
      commonjs: "react-dom",          
      commonjs2: "react-dom",          
      amd: "ReactDOM",          
      root: "ReactDOM"      
    }  
  }
};
