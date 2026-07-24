# Repository Contribution Rules

- **Branching Baseline**: Always base new feature branches on the latest `master` branch.
- **Sync Before Branching**: Before creating a new branch, go to `master`, fetch all upstream changes (`git fetch upstream`), verify the working tree is clean, and update/reset local `master` to match the upstream `master` exactly. Warn that the reset can discard uncommitted changes or local commits, require preserving or backing up any local work first, and only proceed when the tree is clean.
- **Clean Commits**: Keep the commit history clean by squashing intermediate/work-in-progress commits into structured, single descriptive commits before submitting pull requests.
