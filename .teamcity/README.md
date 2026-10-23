# CI

CI type-checks this Bitbucket repository and mirrors it, including Git LFS objects, to the public GitHub repository [ImFusionGmbH/test-mirror](https://github.com/ImFusionGmbH/public-web-demos).
Nothing is built, tested, or published elsewhere.

| Build configuration         | Purpose                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Typecheck/Mirror to GitHub  | Type-checks the demos and mirrors the repository, including Git LFS objects, to the public GitHub repository |

## Design decisions

- **Why are typecheck and the mirror in one build configuration?**
  The mirror steps run only after `npm ci` and `npm run typecheck` succeed for the same revision.
  The push steps are gated on the default branch, so pull-request branches are type-checked and never pushed to GitHub.
- **Why `npm ci`?**
  It installs exactly what the committed `package-lock.json` specifies, so builds are reproducible.
  The `@imfusion/*` packages are on public npm, so no registry credentials are needed.
- **Why does the NPM cache live on the agent?**
  `NPM_CONFIG_CACHE` points at a directory under the agent home, bind-mounted into the Node container.
  Later builds reuse downloaded packages, and a clean checkout does not wipe the cache.
- **Why push LFS objects separately?**
  The `.imf` example data is stored in Git LFS.
  A plain `git push` only transfers the LFS pointer files, so `git lfs push` uploads the referenced objects first.
- **Why no force push?**
  GitHub is a read-only mirror.
  A plain push fails loudly if someone commits directly on GitHub or history is rewritten on Bitbucket, instead of silently discarding commits.
- **Why push the commit SHA rather than `HEAD`?**
  `%build.vcs.number%` is the exact revision TeamCity checked out, independent of how the agent set up the local branch.
- **Why `commitStatusPublisher` and `pullRequests`?**
  Commit status shows the typecheck result in the Bitbucket pull request, and the pull-request feature builds those branches.
  The GitHub push steps stay gated on the default branch, so pull-request branches are never mirrored.
- **Why do the mirror steps run on the agent host?**
  They only need Git and Git LFS, so a container adds nothing.
- **Why is each non-default branch limited to one running build?**
  A newer push cancels the older run, so an obsolete typecheck does not keep an agent busy.
  The default branch is unlimited, so an in-progress mirror is not aborted.
