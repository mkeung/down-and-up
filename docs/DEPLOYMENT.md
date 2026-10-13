# Deployment

Use this guide to build and install Android APKs and connect the mobile app to a hosted backend. Release and device acceptance checks remain in [RELEASE.md](RELEASE.md).

## Current Android deployment

As of October 12, 2026, the standalone app has been built locally and installed by USB on a Motorola moto g stylus 5G (2024), running Android 15. Its package is `app.downandup.tracker`. The APK is saved at `dist/android/down-and-up-1.0.0.apk`, which is ignored by Git. It includes the larger adaptive launcher icon.

The installed build has no configured API origin and works locally. Configure the backend URL and rebuild before using sync or the web dashboard.

## Android signing location

The current installation uses a dedicated local sideload key, not the generated Android debug key. Its files are on this Mac, outside the repository:

```text
/Users/mkeung/Library/Application Support/DownUp/android-signing/
├── sideload.keystore      Private signing key, in PKCS12 format
├── sideload.json          Signing alias and password
└── sideload.init.gradle   Applies this key to the Gradle release build
```

The equivalent portable directory is `~/Library/Application Support/DownUp/android-signing/`. The alias is `downup-sideload`. The JSON contains the password; do not paste its contents into logs, commands, documentation, or source control. The directory has owner-only access and all three files have mode `0600`.

Back up these files together in secure storage. Reuse this key for updates to the installed app. A different signing key cannot update it in place, and uninstalling the app deletes its local entries. A clean Expo prebuild can restore debug signing in the generated native project; always apply the signing init script below.

## Local Android build

Requirements: Node.js 24, pnpm 12.9.1, Python 3, Java 17, and the Android SDK. The tested SDK uses platform/build tools 36 and NDK `27.1.12297006`. Android Studio can install the SDK components. The commands below use the macOS SDK location `~/Library/Android/sdk` and build ARM64, the architecture used by the Motorola.

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
node scripts/icons.mjs
pnpm --filter @down-up/mobile exec expo prebuild --no-clean --no-install --platform android
```

If sync is needed, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to the deployed HTTPS origin before building. Leaving it unset produces a locally usable app. This is public configuration; never put backend credentials in mobile environment variables.

Build and verify the signed APK without printing the signing password:

```sh
python3 - <<'PY'
import json
import os
import shutil
import subprocess
from pathlib import Path

signing_dir = Path.home() / 'Library/Application Support/DownUp/android-signing'
sdk_dir = Path.home() / 'Library/Android/sdk'
required = ['sideload.json', 'sideload.keystore', 'sideload.init.gradle']
if not all((signing_dir / name).is_file() for name in required):
    raise SystemExit('Restore the existing signing files before building an update.')
signing = json.loads((signing_dir / 'sideload.json').read_text())
build_env = os.environ.copy()
build_env.update({
    'ANDROID_HOME': str(sdk_dir),
    'NODE_ENV': 'production',
    'DU_ANDROID_KEYSTORE': str(signing_dir / 'sideload.keystore'),
    'DU_ANDROID_PASSWORD': signing['password'],
    'DU_ANDROID_ALIAS': signing['alias'],
})
subprocess.run([
    './gradlew', ':app:assembleRelease',
    '-PreactNativeArchitectures=arm64-v8a',
    '--init-script', str(signing_dir / 'sideload.init.gradle'),
    '--console=plain', '--max-workers=2',
], cwd='apps/mobile/android', env=build_env, check=True)
apk = Path('apps/mobile/android/app/build/outputs/apk/release/app-release.apk')
subprocess.run([
    str(sdk_dir / 'build-tools/36.0.0/apksigner'),
    'verify', '--verbose', str(apk),
], check=True)
output = Path('dist/android/down-and-up-1.0.0.apk')
output.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(apk, output)
print('Signed APK:', output.resolve())
PY
```

This embeds JavaScript and assets in a release APK; Metro and Expo Go are not needed to run it. When changing the app version, update the output filename accordingly. Icon, splash, orientation, and other native configuration changes require prebuild plus a new APK installation.

## Install or update by USB

For a Family Link device, enable **Developer options** for that device in the parent app. On the phone, tap **Settings → About phone → Build number** seven times, then enable **Settings → System → Developer options → USB debugging**. Connect the phone, unlock it, and accept the USB debugging authorization prompt.

Use the device serial shown by the first command in place of `YOUR_DEVICE_SERIAL`:

```sh
adb devices -l
adb -s YOUR_DEVICE_SERIAL install -r dist/android/down-and-up-1.0.0.apk
adb -s YOUR_DEVICE_SERIAL shell am start -W -n app.downandup.tracker/.MainActivity
```

`install -r` updates the existing installation while retaining app data. OpenMTP is not needed. After installation, check the launcher icon and cold launch. For an offline test, choose **Keep on this phone only**, then verify saving and History without a connection. Sound effects follow the phone's Silent/Vibrate setting, plus the app's Mute/Volume settings and media volume; other media apps playing sound does not prove Ring mode is enabled.

An alternative is to transfer or download the APK and open it on the phone. Family Link must allow **Apps from unknown sources** for that device, and the browser or Files app opening the APK must have **Allow from this source** enabled. These permissions and USB debugging can be disabled after installation, then re-enabled for the next update.

## Expo EAS alternative

The [preview profile](../apps/mobile/eas.json) produces an installable APK; the production profile is for store builds. Run EAS commands from `apps/mobile`:

```sh
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build:configure
pnpm dlx eas-cli@latest credentials --platform android
pnpm dlx eas-cli@latest build --platform android --profile preview
```

Link the project to the correct Expo owner and add its generated `extra.eas.projectId` to `app.config.ts` if requested. Configure EAS to use the existing sideload keystore before building an update for this phone; generating a different key prevents updating its current installation. The local Gradle init script is not automatically used by EAS.

The current EAS preview and production profiles set `EXPO_PUBLIC_API_URL` to `https://down-and-up.vercel.app` through their `env` fields. Keep that public origin aligned with the deployed backend; profile settings do not configure a direct local Gradle build. EAS environment variables are another configuration option. Ignored local `.env.local` files are not available to cloud builds.

See the official [APK guide](https://docs.expo.dev/build-reference/apk/) and [Android credentials guide](https://docs.expo.dev/app-signing/app-credentials/).

## Web and backend

The web app and API use Vercel with Postgres, Upstash Redis, and a private R2 bucket. Follow [README: Configuration](../README.md#configuration) and [README: Deployment](../README.md#deployment) for environment variables, migrations, project root, cron jobs, and staging verification. Keep staging and production separate and complete [the infrastructure release checks](RELEASE.md#infrastructure) before public release.

The mobile APK can be deployed independently for offline use. Sync, web history, and web-configured reminders require the hosted backend and its HTTPS origin in the mobile build.
