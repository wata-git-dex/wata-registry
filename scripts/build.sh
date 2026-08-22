#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
dist_dir="$project_dir/dist"

if [ -d "$dist_dir" ]; then
  find "$dist_dir" -mindepth 1 -delete
fi
mkdir -p "$dist_dir"
cp "$project_dir/index.html" "$project_dir/app.js" "$project_dir/styles.css" "$project_dir/theme-init.js" "$project_dir/partner-branding.js" "$project_dir/manifest.webmanifest" "$project_dir/sw.js" "$project_dir/_headers" "$dist_dir/"
cp -R "$project_dir/assets" "$dist_dir/assets"
cp -R "$project_dir/guides" "$dist_dir/guides"
cp "$project_dir/gateway.js" "$dist_dir/_worker.js"
