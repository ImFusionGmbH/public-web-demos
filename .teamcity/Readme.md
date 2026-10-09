# CI

CI type-checks every branch of this Bitbucket repository.
Once the typecheck passes, the default branch, including its Git LFS objects, is mirrored to the public GitHub repository
[<github-org>/<github-repo>](https://github.com/<github-org>/<github-repo>).
Nothing is built, tested, or published elsewhere.

| Build configuration | Purpose                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| Typecheck           | Runs `npm ci` and `npm run typecheck` on every branch                             |
| Mirror to GitHub    | Pushes the default branch and its LFS objects to `master` on GitHub after Typecheck |

## Design decisions

- **Why is Typecheck a separate build configuration?**
  It runs on every branch, whereas the mirror only runs on the default branch.
- **Why does the mirror have a snapshot dependency on Typecheck?**
  With `FAIL_TO_START`, a revision that fails the typecheck never reaches GitHub.
  The dependency also reuses or triggers the Typecheck build for the exact same revision.
- **Why `npm ci`?**
  It installs exactly what the committed `package-lock.json` specifies, so builds are reproducible.
  The `@imfusion/*` packages are on public npm, so no registry credentials are needed.
- **Why push LFS objects separately?**
  The `.imf` example data is stored in Git LFS.
  A plain `git push` only transfers the LFS pointer files, so `git lfs push` uploads the referenced objects first.
- **Why no force push?**
  GitHub is a read-only mirror.
  A plain push fails loudly if someone commits directly on GitHub or history is rewritten on Bitbucket, instead of silently discarding commits.
- **Why push the commit SHA rather than `HEAD`?**
  `%build.vcs.number%` is the exact revision TeamCity checked out, independent of how the agent set up the local branch.
- **Why no `commitStatusPublisher` or `pullRequests`?**
  The mirror is not part of pull-request review, and pull-request branches must never be pushed to GitHub.
- **Why do the mirror steps run on the agent host?**
  They only need Git and Git LFS, so a container adds nothing.
- **Why are concurrent builds harmless?**
  Pushing an older commit after a newer one is rejected as a non-fast-forward update, so GitHub never moves backwards.
