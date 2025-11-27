const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for Cashu Wallet
 * Configures crypto polyfills and native module resolution
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      // Crypto polyfills - alias to react-native-quick-crypto
      crypto: require.resolve('react-native-quick-crypto'),
      stream: require.resolve('readable-stream'),
      buffer: require.resolve('@craftzdog/react-native-buffer'),
    },
    // Custom resolution for crypto modules
    resolveRequest: (context, moduleName, platform) => {
      // Alias crypto imports to react-native-quick-crypto
      if (moduleName === 'crypto') {
        return context.resolveRequest(
          context,
          'react-native-quick-crypto',
          platform,
        );
      }
      // Default resolver
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
