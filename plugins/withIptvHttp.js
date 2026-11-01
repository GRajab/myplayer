const { withAndroidManifest } = require('expo/config-plugins');
// User-supplied IPTV providers commonly expose HTTP playlist and stream URLs.
module.exports = config => withAndroidManifest(config, mod => {
  const application = mod.modResults.manifest.application?.[0];
  if (application) application.$['android:usesCleartextTraffic'] = 'true';
  return mod;
});
