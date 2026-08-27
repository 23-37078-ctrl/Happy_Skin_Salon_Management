# Happy Skin Salon Frontend

Vite/React frontend with Capacitor projects for Android and iOS.

## Web development

```powershell
npm install
npm run dev
```

## Android

Install Android Studio and its Android SDK, then run:

```powershell
npm run android:open
```

The command builds the web app, synchronizes it into `android/`, and opens the
native project. Select an emulator or connected device and press **Run** in
Android Studio.

For local API testing with an Android device or emulator, keep the backend at
`http://localhost:8000` and forward that device port before launching the app:

```powershell
adb reverse tcp:8000 tcp:8000
```

For a release build, set `VITE_API_URL` to the deployed backend's HTTPS URL.
Never place database, JWT, SMTP, or third-party secret keys in `VITE_*`
variables because Vite embeds them in the client application.

## iOS

The `ios/` project is generated and synchronized. Building and signing it
requires macOS, Xcode, and an Apple Developer account:

```bash
npm run ios:open
```

## Useful commands

```powershell
npm run mobile:sync
npm run mobile:doctor
npm run android:run
```

After every web-code change, run `npm run mobile:sync` before producing a
native build.
