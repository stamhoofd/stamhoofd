/** Keep private environment names out of generated scripts: request them from the active checkout at Tab time. */
export function docsEnvironmentCompletionScript(shell: string, cacheDir: string): string {
    const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
    if (shell === 'bash')
        return `source ${quote(`${cacheDir}/bash_setup`)}
_stam_local_completion() {
    local cur="\${COMP_WORDS[COMP_CWORD]}" prefix=""
    if [[ "\${COMP_WORDS[1]} \${COMP_WORDS[2]} \${COMP_WORDS[3]}" != "docs image publish" ]]; then
        _stam_autocomplete
        return
    fi
    if [[ "$cur" == --environment=* ]]; then
        prefix="--environment="
        cur="\${cur#*=}"
    elif [[ "\${COMP_WORDS[COMP_CWORD-1]}" == "--environment" ]]; then
        [[ "$cur" == "=" ]] && cur=""
    elif [[ "\${COMP_WORDS[COMP_CWORD-1]}" == "=" && "\${COMP_WORDS[COMP_CWORD-2]}" == "--environment" ]]; then
        : # Bash splits equals-form flags at COMP_WORDBREAKS by default.
    else
        _stam_autocomplete
        return
    fi
    COMPREPLY=()
    local value
    while IFS= read -r value; do
        [[ -n "$value" ]] && COMPREPLY+=("$prefix$value")
    done < <(stam completion environments "$cur" 2>/dev/null)
}
complete -F _stam_local_completion stam`;
    return `source ${quote(`${cacheDir}/zsh_setup`)}
_stam_local_completion() {
    local cur="$words[CURRENT]" prefix="" value
    if [[ "$words[2] $words[3] $words[4]" == "docs image publish" && ( "$words[CURRENT-1]" == "--environment" || "$cur" == --environment=* ) ]]; then
        if [[ "$cur" == --environment=* ]]; then
            prefix="--environment="
            cur="\${cur#*=}"
        fi
        local -a values
        values=("\${(@f)$(stam completion environments "$cur" 2>/dev/null)}")
        for value in "$values[@]"; do
            [[ -n "$value" ]] && compadd -- "$prefix$value"
        done
        return 0
    else
        autoload -Uz _stam
        _stam "$@"
    fi
}
compdef _stam_local_completion stam`;
}

/** Embed the maintained generator's output so installed files do not depend on a user's cache. */
export function standaloneCompletionScript(shell: string, generated: string): string {
    const bridge = docsEnvironmentCompletionScript(shell, '').replace(/^source .*\n/, '');
    if (shell === 'bash') return `${generated}\n${bridge}\n`;
    const definitions = generated
        .replace(/\b_stam\b/g, '_stam_generated')
        .replace(/\n_stam_generated\s*$/, '\n');
    return `${definitions}\n${bridge
        .replaceAll('_stam_local_completion', '_stam')
        .replace('        autoload -Uz _stam\n', '')
        .replace('        _stam "$@"', '        _stam_generated "$@"')
        .replace('compdef _stam stam', '_stam "$@"')}\n`;
}
