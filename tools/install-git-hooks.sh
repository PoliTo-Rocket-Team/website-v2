#!/bin/sh
# The `prepare` script: `pnpm install` installs lefthook's git hooks.
# Only the main checkout installs them; everywhere else this returns at once.
set -eu

# CI never checks out a second branch by hand, so it gets no hooks.
if [ -n "${CI:-}" ]; then exit 0; fi

# Outside a Git checkout (a tarball, a build image) there is nothing to install into.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Linked worktrees share the main checkout's hooks directory, so an install from
# one would only rewrite the same files while sibling worktrees read them.
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] || exit 0

lefthook install
