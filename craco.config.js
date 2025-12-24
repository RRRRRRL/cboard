const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = {
  webpack: {
    entry: './src/index.js',
    plugins: [new NodePolyfillPlugin({ excludeAliases: ['console'] })],
    resolve: {
      extensions: ['.web.js', '.mjs', '.js', '.json', '.web.jsx', '.jsx']
    },
    configure: (webpackConfig, { env, paths }) => {
      const isCordovaDebug = process.argv.includes('--cordova-debug');
      if (isCordovaDebug) {
        webpackConfig.mode = 'development';
        webpackConfig.optimization = { minimize: false };
        console.log('Cordova debug mode enabled');
      }

      webpackConfig.ignoreWarnings = [
        function ignoreSourcemapsloaderWarnings(warning) {
          return (
            warning.module?.resource.includes('node_modules') &&
            warning.details?.includes('source-map-loader')
          );
        }
      ];

      // Disable TypeScript type checking to avoid compatibility issues with Node.js v24+
      // This is safe since the project is primarily JavaScript
      // Remove fork-ts-checker-webpack-plugin if present
      if (webpackConfig.plugins) {
        webpackConfig.plugins = webpackConfig.plugins.filter(plugin => {
          if (!plugin) return true;
          // Check by constructor name
          if (plugin.constructor && plugin.constructor.name) {
            const name = plugin.constructor.name;
            if (name.includes('ForkTsChecker') || name.includes('TypeScript')) {
              console.log(`[Craco] Removing TypeScript checker plugin: ${name}`);
              return false;
            }
          }
          // Check by plugin options/identifier
          if (plugin.options && (plugin.options.typescript || plugin.options.tsconfig)) {
            console.log('[Craco] Removing TypeScript checker plugin (detected by options)');
            return false;
          }
          return true;
        });
      }
      
      // Also disable TypeScript checking in development mode
      if (process.env.TSC_COMPILE_ON_ERROR === 'true') {
        // Set environment variable to skip type checking
        process.env.SKIP_TYPE_CHECK = 'true';
      }

      return webpackConfig;
    }
  },
  babel: {
    plugins: ['babel-plugin-transform-import-meta']
  }
};
