/**
 * Converts the GitHub-flavoured markdown used in release notes into Slack mrkdwn so it renders
 * nicely inside a Slack message instead of showing raw `###`, `**bold**` and `[text](url)` syntax.
 *
 * Handles the constructs that actually appear in our notes: ATX headings, bold, links, bullet lists
 * and horizontal rules. Inline code spans and fenced code blocks are passed through untouched so
 * their contents are never rewritten. Italic (`_text_`) is already valid Slack mrkdwn and is left
 * as-is. This is a pragmatic converter, not a full CommonMark implementation.
 */
export function markdownToSlack(markdown: string): string {
    const out: string[] = [];
    let inFence = false;

    for (const line of markdown.split('\n')) {
        if (/^\s*```/.test(line)) {
            inFence = !inFence;
            out.push(line);
            continue;
        }
        out.push(inFence ? line : convertLine(line));
    }

    return out.join('\n');
}

/** A visible divider, replacing markdown horizontal rules (e.g. the `---` between the English and Dutch notes). */
const SLACK_DIVIDER = '────────────────';

function convertLine(line: string): string {
    // Horizontal rule: a line of only -, * or _ (e.g. "---", "***", "- - -").
    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
        return SLACK_DIVIDER;
    }

    // ATX heading: "# .." through "###### ..". Slack has no headings, so bold it (stripping closing hashes).
    const heading = line.match(/^[ \t]{0,3}#{1,6}[ \t]+(\S.*)$/);
    if (heading) {
        const stripped = heading[1].replace(/[ \t]+#+[ \t]*$/, '');
        const content = transformInline(stripped).replace(/\*/g, '').trim();
        return content.length > 0 ? `*${content}*` : '';
    }

    // Unordered list item: "- ", "* " or "+ " (keeping any indentation for nested items).
    const bullet = line.match(/^([ \t]*)[-*+][ \t]+(\S.*)$/);
    if (bullet) {
        return `${bullet[1]}• ${transformInline(bullet[2])}`;
    }

    return transformInline(line);
}

/** Applies inline transforms (links, bold) to the parts of a line that are outside inline code spans. */
function transformInline(text: string): string {
    // Split on backtick spans; odd indices are code spans and must not be rewritten.
    return text
        .split(/(`[^`]*`)/g)
        .map((part, index) => index % 2 === 1 ? part : transformInlineOutsideCode(part))
        .join('');
}

function transformInlineOutsideCode(text: string): string {
    return text
        // [label](url) -> <url|label>
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<$2|$1>')
        // **bold** / __bold__ -> *bold*
        .replace(/\*\*([^*]+)\*\*/g, '*$1*')
        .replace(/__([^_]+)__/g, '*$1*');
}
