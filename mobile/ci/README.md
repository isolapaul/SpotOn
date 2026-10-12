# Demo Firebase app configs (CI only)

Non-secret placeholder configs for the `demo-spoton` project, so CI can build the apps without the real
Firebase project's files. Builds made with them start, but Google sign-in and push notifications do not
work. Release builds use the real `google-services.json` / `GoogleService-Info.plist` (repository
secrets `GOOGLE_SERVICES_JSON_BASE64` / `GOOGLE_SERVICE_INFO_PLIST_BASE64`, or the files on the laptop;
docs/deploy.md §17).
