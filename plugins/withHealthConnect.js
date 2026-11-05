// Health Connect support for the local `rematch-health` module (modules/rematch-health).
//
// androidx.health.connect:connect-client 1.1.0 (the module's dependency) requires minSdk 26, while React Native's
// default is 24. In Expo SDK 57's Android template the `android.minSdkVersion` Gradle property overrides the
// `minSdk` version of the `expoLibs` version catalog (settings.gradle → useExpoVersionCatalog), and the
// expo-root-project plugin turns that into rootProject.ext.minSdkVersion, which the app and every module read.
// The permissions, the rationale activity and the <queries> entry come from the module's own AndroidManifest.xml.
// This only touches android/gradle.properties, so it does nothing on iOS.
const { withGradleProperties } = require('expo/config-plugins');

const MIN_SDK_PROPERTY = 'android.minSdkVersion';
const HEALTH_CONNECT_MIN_SDK = 26;

function withHealthConnect(config) {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const existing = properties.find((item) => item.type === 'property' && item.key === MIN_SDK_PROPERTY);
    if (!existing) {
      properties.push(
        { type: 'comment', value: 'Health Connect (androidx.health.connect:connect-client) requires API 26' },
        { type: 'property', key: MIN_SDK_PROPERTY, value: String(HEALTH_CONNECT_MIN_SDK) },
      );
    } else if (!(Number.parseInt(existing.value, 10) >= HEALTH_CONNECT_MIN_SDK)) {
      // Raise a lower (or unreadable) value; never lower one that is already higher.
      existing.value = String(HEALTH_CONNECT_MIN_SDK);
    }
    return config;
  });
}

module.exports = withHealthConnect;
