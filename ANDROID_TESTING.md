# MyPlayer Android test build

The `preview` EAS profile produces a signed, standalone APK with bundled JavaScript. It runs without Expo Go or Metro.

Package: `com.rajab.myplayer`
Version: `1.1.0` (Android version code 2)

Build from PowerShell in this folder:

```powershell
$env:EAS_NO_VCS = '1'
npx eas-cli@latest build --platform android --profile preview
```

Sign in with `npx eas-cli@latest login` if needed. Use the Expo account that owns this project. EAS manages the signing key; keep that key for future updates.

After a successful build, open its APK download link on Android and install it. Allow installation from that browser if Android asks. This app has separate storage from Expo Go; add your playlist in the installed MyPlayer app.

Check the launcher icon and splash, playlist loading after restart, Live TV, Movies, Series, resume, audio/subtitles, rotation, Back, and reconnecting after a network interruption. The current source preserves the saved Version 1 archive unchanged.

## Branding assets

- App icon: `assets/images/myplayer-icon.png` (approved M + Play preview).
- Adaptive foreground and splash mark: `assets/images/myplayer-mark.png`.
- Generated with the built-in image generation tool using the approved icon as the edit target. Prompt: remove only the navy background, including negative space inside the M/play mark, to true transparency; preserve the cyan silhouette, position and proportions on a square canvas.
- Splash background: `#0F172A`.

## First cloud build

Project: https://expo.dev/accounts/mydev26/projects/myplayer

Build: https://expo.dev/accounts/mydev26/projects/myplayer/builds/f398bdde-6e40-4460-b7e8-376c2256ffce

Local validation: Android JavaScript export succeeded; Expo Doctor 20/20, lint and typecheck passed. SDK 58 dependencies were aligned to their recommended patch versions.

## Ready to install

APK download: https://expo.dev/artifacts/eas/owWlsVq5dvYKbsMp22LOlFyJx5hwAnh6uwI2eAiXBlw.apk

Local copy: `builds/MyPlayer-1.0.0-preview.apk` (110.3 MB). The file was checked for ZIP integrity, Android manifest, DEX contents and package identity. SHA-256 is saved beside the APK; build details are in `builds/android-preview.json`.

Includes arm64-v8a, armeabi-v7a, x86 and x86_64 native binaries. Open the download on your Android device and approve the installation prompt. Allow installation from your browser if Android requests it. Add your playlist once in the installed app because its storage is separate from Expo Go.
