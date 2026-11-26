# MetaTube Android

Multi-provider video & MP3 downloader, offline media player, multi-threaded download engine, and playlist organizer built with Kotlin & Jetpack Compose.

## GitHub Actions Auto-Build & Release Setup

AI Studio's GitHub integration pushes code without the `workflow` OAuth scope, so the CI workflow file is stored at `ci/android-release.yml`.

To enable automatic APK/AAB builds and GitHub Releases on every push:
1. Open your repository on GitHub.
2. Go to **Add file -> Create new file** and name it `.github/workflows/android-release.yml`.
3. Copy the contents of `ci/android-release.yml` into `.github/workflows/android-release.yml` and commit directly on GitHub.
4. *(Optional)* In **Settings -> Secrets and variables -> Actions**, add `KEYSTORE_BASE64`, `STORE_PASSWORD`, `KEY_PASSWORD`, and `YOUTUBE_INNERTUBE_KEY` to sign releases with your upload key.
