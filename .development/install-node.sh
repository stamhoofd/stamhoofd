# Source this file so nvm can activate the requested version in the current shell.
if ! command -v nvm >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        echo "nvm is not installed or could not be found at $NVM_DIR/nvm.sh" >&2
        return 1
    fi
    . "$NVM_DIR/nvm.sh"
fi

nvmrc_path="$(nvm_find_nvmrc)"
if [ -z "$nvmrc_path" ]; then
    echo "No .nvmrc found. Run this script from inside the Stamhoofd repository." >&2
    return 1
fi

requested_version="$(cat "$nvmrc_path")"
installed_version="$(nvm version "$requested_version")"
current_version="$(nvm current)"
marker_dir="$(dirname "$nvmrc_path")/.development/cli/generated/node-versions"
marker_path="$marker_dir/${current_version}_to_${requested_version}"

if [ "$installed_version" = "N/A" ] || { [ "$installed_version" != "$current_version" ] && [ ! -f "$marker_path" ]; }; then
    mkdir -p "$marker_dir"
    nvm install --reinstall-packages-from=current
    touch "$marker_path"
elif [ "$installed_version" != "$current_version" ]; then
    nvm use
else
    echo "Already using $installed_version."
fi

unset current_version installed_version marker_dir marker_path nvmrc_path requested_version
