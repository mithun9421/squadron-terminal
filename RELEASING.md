# Releasing Squadron Terminal

Releases are built by CI, not locally — a Windows installer can't be produced on macOS, so
`.github/workflows/release.yml` builds macOS (Apple Silicon + Intel) and Windows on their native
GitHub Actions runners and attaches all three installers to one GitHub Release.

## Cutting a release

1. Bump the version in **both** `package.json` and `src-tauri/tauri.conf.json` (they must match).
2. Commit that version bump.
3. Tag it and push the tag — this is what triggers the workflow:
   ```bash
   git tag app-v0.1.0
   git push origin app-v0.1.0
   ```
4. Watch the run: `gh run watch` or the repo's **Actions** tab. Three jobs run in parallel
   (`macos-latest` × 2 targets, `windows-latest` × 1); all three must go green.
5. The workflow creates the release as a **draft** — nothing is publicly downloadable yet. Open it
   under **Releases**, check that all three installers are attached (two `.dmg`, one `.msi`), edit the
   release notes if needed, then click **Publish release**.

## Notes

- Builds are **unsigned** for now (no Apple Developer or Windows code-signing certificates configured).
  Users will see a Gatekeeper/SmartScreen warning on first run — the release notes explain the bypass
  (right-click → Open on macOS; "More info" → "Run anyway" on Windows). Signing can be added later by
  providing certs as repository secrets and extending the `tauri-action` step's `env`.
- The tag format is `app-v<version>` (not just `v<version>`) — this is `tauri-action`'s own convention
  and is what `release.yml`'s `on.push.tags` filter matches.
- The landing page's download buttons link to `/releases/latest`, which always resolves to the most
  recently *published* (non-draft, non-prerelease) release — no need to update the site per release.
