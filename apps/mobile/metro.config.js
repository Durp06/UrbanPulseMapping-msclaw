const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro resolve packages from monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// pnpm uses symlinks that Metro can't follow.
// Force React to resolve to a single copy to avoid "useMemo of null" crashes
const reactPath = fs.realpathSync(require.resolve('react', { paths: [projectRoot] }));
const reactDir = path.dirname(reactPath);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force all react imports to the same physical location
  if (moduleName === 'react' || moduleName === 'react/jsx-runtime' || moduleName === 'react/jsx-dev-runtime') {
    const suffix = moduleName === 'react' ? 'index.js' : moduleName.split('/').pop() + '.js';
    return { type: 'sourceFile', filePath: path.join(reactDir, suffix) };
  }

  // Handle firebase/* and @firebase/* modules that are behind pnpm symlinks
  if (moduleName.startsWith('firebase/') || moduleName === 'firebase' ||
      moduleName.startsWith('@firebase/')) {
    try {
      const resolved = require.resolve(moduleName, { paths: [projectRoot] });
      return { type: 'sourceFile', filePath: resolved };
    } catch {
      // Fall through to default
    }
  }
  
  // Handle @react-native-async-storage behind pnpm symlinks
  if (moduleName.startsWith('@react-native-async-storage/')) {
    try {
      const resolved = require.resolve(moduleName, { paths: [projectRoot] });
      return { type: 'sourceFile', filePath: resolved };
    } catch {
      // Fall through
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Block Node-only modules that Firebase tries to import but doesn't need in RN
config.resolver.resolveRequest = ((originalResolver) => {
  const nodeOnlyModules = ['undici', 'node:buffer', 'node:crypto', 'node:events', 'node:http', 'node:https', 'node:net', 'node:stream', 'node:url', 'node:util', 'node:zlib'];
  const prevResolver = originalResolver;
  return (context, moduleName, platform) => {
    if (nodeOnlyModules.includes(moduleName)) {
      return { type: 'empty' };
    }
    return prevResolver(context, moduleName, platform);
  };
})(config.resolver.resolveRequest);

// Also watch the real pnpm store paths so Metro can access resolved files
const pnpmStore = path.resolve(monorepoRoot, "node_modules/.pnpm");
if (fs.existsSync(pnpmStore)) {
  config.watchFolders.push(pnpmStore);
}

// Inject hermes-polyfill before all modules
const polyfillPath = path.resolve(projectRoot, "hermes-polyfill.js");
const originalGetPolyfills = config.serializer?.getPolyfills;
config.serializer = {
  ...config.serializer,
  getPolyfills: (options) => {
    const defaultPolyfills = originalGetPolyfills 
      ? originalGetPolyfills(options) 
      : require(require.resolve('@react-native/js-polyfills', { paths: [projectRoot] }))();
    return [...defaultPolyfills, polyfillPath];
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
