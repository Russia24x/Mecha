#!/bin/bash
# MECHA: LAST PROTOCOL — Auto-sync to GitHub
# This script commits all changes and pushes to GitHub.
# Designed to run after worklog updates or at end of each session.
#
# Usage:
#   bash scripts/auto-sync.sh "commit message"
#   bash scripts/auto-sync.sh  # uses default message with timestamp

set -e

cd /home/z/my-project

# Commit message
MSG="${1:-auto-sync: $(date -u '+%Y-%m-%d %H:%M:%S UTC')}"

echo "=== MECHA Auto-Sync ==="
echo "Commit message: $MSG"
echo ""

# Update STATUS.md timestamp
sed -i "s/\*\*Last updated:\*\* .*/\*\*Last updated:\*\* $(date -u '+%Y-%m-%d')/" /home/z/my-project/STATUS.md 2>/dev/null || true

# Stage all changes (excluding node_modules, .next, skills, upload via .gitignore)
# Always include STATUS.md explicitly
git add -A
git add STATUS.md 2>/dev/null || true

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
  echo "✓ Committed"
fi

# Push to GitHub
echo "Pushing to GitHub..."
if git push origin main 2>&1; then
  echo "✓ Pushed to GitHub successfully"
else
  echo "✗ Push failed — check your token permissions"
  exit 1
fi

# Also create tar backup to /home/sync
echo "Creating tar backup..."
tar cf /home/sync/repo.tar \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=upload \
  --exclude=skills \
  --exclude=.git \
  . 2>/dev/null || true
echo "✓ Tar backup saved to /home/sync/repo.tar"

echo ""
echo "=== Sync complete ==="
echo "GitHub: https://github.com/Russia24x/Mecha"
echo "Backup: /home/sync/repo.tar ($(du -h /home/sync/repo.tar | cut -f1))"
