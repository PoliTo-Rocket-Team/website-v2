#!/bin/sh
# The `prepare` script: `pnpm install` writes the *.pen clean filter's config
# and installs lefthook's git hooks. The filter config is shared by every
# worktree; only the main checkout installs the hooks.
set -eu

# CI never checks out a second branch by hand, so it gets no hooks.
if [ -n "${CI:-}" ]; then exit 0; fi

# Outside a Git checkout (a tarball, a build image) there is nothing to install into.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# .gitattributes sends *.pen through this filter, which drops Pencil's random
# "fileToken" from what gets committed (tools/strip-pen-filetoken.mjs). It lands
# in the common .git/config, so every linked worktree sees it.
git config filter.pen-filetoken.clean "node tools/strip-pen-filetoken.mjs"

# Linked worktrees share the main checkout's hooks directory, so an install from
# one would only rewrite the same files while sibling worktrees read them.
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] || exit 0

lefthook install
