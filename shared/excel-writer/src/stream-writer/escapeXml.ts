export function escapeXml(str: string): string {
    // "   &quot;
    // '   &apos;
    // <   &lt;
    // >   &gt;
    // &   &amp;
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&apos;')
        .replace(/"/g, '&quot;');
}
