const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
const ShellPlugin = require("webpack-shell-plugin-next");
const { version } = require("./package.json");

const isProduction = process.env.NODE_ENV == "production";

/** @type {webpack.Configuration} */
const config = {
  entry: "./index.ts",
  output: {
    clean: true,
    path: path.resolve(__dirname, "dist"),
  },
  target: "node",
  devtool: false,
  optimization: {
    minimize: isProduction,
    nodeEnv: false,
  },
  node: {
    global: false,
    __dirname: false,
    __filename: false,
  },
  externals: [nodeExternals()],
  externalsPresets: { node: true },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/i,
        loader: "ts-loader",
        exclude: ["/node_modules/"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "package.json",
          to: "package.json",
          transform: (content) => {
            const json = JSON.parse(content.toString());
            json.bin = { "type-sitter": "./main.js" };
            delete json.devDependencies;
            delete json.scripts;
            return JSON.stringify(json, null, 2);
          },
        },
        { from: "README.md", to: "README.md" },
        { from: "LICENSE", to: "LICENSE", toType: "file" },
      ],
    }),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(version),
    }),
    new webpack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true,
    }),
    new ShellPlugin({
      onBuildEnd: {
        scripts: ["chmod +x dist/main.js"],
      },
    }),
  ],
};

module.exports = () => {
  if (isProduction) {
    config.mode = "production";
  } else {
    config.mode = "development";
  }
  return config;
};
