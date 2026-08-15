const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidBillingLaunchMode(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      manifestConfig.modResults,
    );
    mainActivity.$["android:launchMode"] = "singleTop";
    return manifestConfig;
  });
};
