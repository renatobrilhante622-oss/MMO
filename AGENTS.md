# Cloud workspace rules

The user explicitly prohibits local Android compilation to conserve quota:
- Do not run Gradle, `./gradlew`, or `npx cap sync android` in this workspace.
- Do not generate APK files or modify the existing APKs in `public/` or `releases/`.
- Validate source changes with `npm test` and `npm run build`, then commit and push to `main` when requested. GitHub Actions handles Android builds.
- Keep developer cheats and simulated opponents separate from authoritative online accounts, matchmaking and economy. Label simulations clearly.
