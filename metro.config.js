const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, metroServer) {
    const enhancedMiddleware = defaultEnhanceMiddleware
      ? defaultEnhanceMiddleware(middleware, metroServer)
      : middleware;

    return (request, response, next) => {
      // iOS can encode Expo's already-encoded unstable_path value a second time.
      // Normalize only asset requests so Metro receives the expected single encoding.
      if (request.url?.startsWith('/assets/')) {
        request.url = request.url.replace(/%252f/gi, '%2F');
      }

      return enhancedMiddleware(request, response, next);
    };
  },
};

module.exports = config;
