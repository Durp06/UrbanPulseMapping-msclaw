const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      
      // Add modular_headers for specific Firebase dependencies that need it
      if (!podfile.includes('GoogleUtilities')) {
        const target = "use_expo_modules!";
        const addition = `
  # Firebase dependencies need modular headers
  pod 'GoogleUtilities', :modular_headers => true
  pod 'FirebaseAuthInterop', :modular_headers => true
  pod 'FirebaseAppCheckInterop', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
  pod 'FirebaseCoreInternal', :modular_headers => true
`;
        podfile = podfile.replace(target, target + addition);
        fs.writeFileSync(podfilePath, podfile);
      }
      
      return config;
    },
  ]);
};
