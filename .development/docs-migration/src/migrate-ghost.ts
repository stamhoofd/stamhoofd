import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parse, NodeType } from 'node-html-parser';
import type { HTMLElement, Node, TextNode } from 'node-html-parser';

// --- Paths & config ---------------------------------------------------------

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = resolve(packageDir, '..', '..');
const contentDir = join(repoDir, 'docs', 'content');

/**
 * Uploads are downloaded into these subfolders of docs/public and served
 * statically from `/images/...`, `/media/...` and `/files/...`.
 */
const publicDir = join(repoDir, 'docs', 'public');
const ASSET_DIRS = ['images', 'media', 'files'] as const;

/** Replaces `__GHOST_URL__` in the export with this absolute base. */
const BASE_URL = 'https://www.stamhoofd.be/docs';

/** Parallel asset downloads. */
const DOWNLOAD_CONCURRENCY = 8;

interface Options {
    input: string | null;
    clean: boolean;
    yes: boolean;
}

function parseArgs(argv: string[]): Options {
    let input: string | null = null;
    let clean = false;
    let yes = false;
    for (const arg of argv) {
        if (arg === '--clean') clean = true;
        else if (arg === '--yes' || arg === '-y') yes = true;
        else if (!arg.startsWith('-') && !input) input = resolve(arg);
    }
    if (!input && !clean) {
        console.error('Nothing to do: pass an export path to import, and/or --clean.');
        process.exit(1);
    }
    return { input, clean, yes };
}

/**
 * Remove everything under content/ and the downloaded uploads. The landing page
 * is a Vue page, not content, and other files in public/ (the logo) are kept.
 */
function cleanContentDir(): void {
    for (const entry of readdirSync(contentDir)) {
        rmSync(join(contentDir, entry), { recursive: true, force: true });
    }
    for (const dir of ASSET_DIRS) {
        rmSync(join(publicDir, dir), { recursive: true, force: true });
    }
}

/** Ask before the destructive clean. Requires a TTY unless --yes is passed. */
async function confirmClean(auto: boolean): Promise<boolean> {
    if (auto) return true;
    if (!process.stdin.isTTY) {
        console.error('✖ Refusing to clean without confirmation in a non-interactive shell. Pass --yes to proceed.');
        return false;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer: string = await rl.question(`This deletes everything under ${contentDir} and the downloaded uploads in ${publicDir}. Continue? [y/N] `);
    rl.close();
    return /^y(?:es)?$/i.test(answer.trim());
}

// --- Ghost export types (only the fields we use) ----------------------------

interface GhostPost {
    id: string;
    title: string;
    slug: string;
    html: string | null;
    plaintext: string | null;
    status: string;
    type: string;
    custom_excerpt: string | null;
    published_at: string | null;
    updated_at: string | null;
}
interface GhostTag { id: string; slug: string; name: string }
interface GhostPostTag { post_id: string; tag_id: string; sort_order: number }

interface GhostData {
    posts: GhostPost[];
    tags: GhostTag[];
    posts_tags: GhostPostTag[];
}

/** Everything is optional: Ghost omits tables it has no rows for. */
interface GhostExport {
    db?: Array<{ data?: Partial<GhostData> }>;
}

/**
 * Read and validate an export. The Ghost site changes over time, so fail with a
 * readable message rather than a TypeError if the shape is not what we expect.
 */
function readExport(path: string): GhostData {
    const raw: string = readFileSync(path, 'utf8');
    let parsed: GhostExport;
    try {
        parsed = JSON.parse(raw) as GhostExport;
    } catch {
        console.error(`✖ Not valid JSON: ${path}`);
        process.exit(1);
    }

    const data = parsed.db?.[0]?.data;
    if (!data) {
        console.error('✖ Unrecognised Ghost export: expected "db[0].data" at the top level.');
        process.exit(1);
    }
    if (!Array.isArray(data.posts)) {
        console.error('✖ Ghost export contains no "posts" table.');
        process.exit(1);
    }

    // tags/posts_tags are optional: without them every post lands in "Overig".
    return { posts: data.posts, tags: data.tags ?? [], posts_tags: data.posts_tags ?? [] };
}

// --- Small helpers ----------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', middot: '·', bull: '•',
    rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
    copy: '©', reg: '®', trade: '™', deg: '°', euro: '€', times: '×',
};

function decodeEntities(input: string): string {
    return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
        if (entity[0] === '#') {
            const codePoint = entity[1] === 'x' || entity[1] === 'X'
                ? parseInt(entity.slice(2), 16)
                : parseInt(entity.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        return NAMED_ENTITIES[entity] ?? match;
    });
}

/** Escape characters that would otherwise be interpreted as Markdown/MDC syntax. */
function escapeInline(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/([[\]`])/g, '\\$1');
}

function isElement(node: Node): node is HTMLElement {
    return node.nodeType === NodeType.ELEMENT_NODE;
}
function isText(node: Node): node is TextNode {
    return node.nodeType === NodeType.TEXT_NODE;
}
function tag(node: HTMLElement): string {
    return (node.tagName || '').toUpperCase();
}
function hasClass(node: HTMLElement, name: string): boolean {
    return node.classList?.contains(name) ?? false;
}

let baseUrl = '';
function fixUrl(url: string | null | undefined): string {
    if (!url) return '';
    return url.replaceAll('__GHOST_URL__', baseUrl);
}

// --- Assets -----------------------------------------------------------------

/**
 * Ghost stores uploads under /content/<kind>/: images are rendered inline,
 * media are videos/audio, files are documents linked from the text. All three
 * are copied into docs/public/<kind>/ so the docs site stops depending on the
 * old Ghost install.
 */
type AssetKind = 'images' | 'media' | 'files';

interface Asset {
    /** Absolute URL of the original (never a resized Ghost variant). */
    url: string;
    kind: AssetKind;
    /** Path of the local copy, relative to docs/public. */
    file: string;
    /** Path the docs site serves the local copy from. */
    route: string;
    /** Intrinsic size of an image, so the site never scales it up. */
    width: number | null;
    height: number | null;
    downloaded: boolean;
}

/** Every asset referenced by the export, keyed by its original URL. */
const assets = new Map<string, Asset>();
const failedAssets: string[] = [];

/** Ghost serves resized copies from `/content/images/size/w1000/...`: we always want the original. */
function originalImageUrl(url: string): string {
    return url.replace(/\/content\/images\/size\/[^/]+\//, '/content/images/');
}

function sanitizeSegment(segment: string): string {
    return segment.replace(/[^\w.-]+/g, '-').replace(/^\.+/, '');
}

/** Where a remote asset ends up under docs/public, or null if we cannot download it. */
function localAssetFile(url: string, kind: AssetKind): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null; // relative or data: URL, leave it alone
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const pathname = decodeURIComponent(parsed.pathname);
    const ghostPath = pathname.match(/\/content\/(?:images|media|files)\/(.+)$/);
    // Ghost uploads keep their year/month path; anything else is namespaced by host.
    const relative = ghostPath ? ghostPath[1] : `external/${parsed.host}${pathname}`;
    const safe = relative.split('/').map(sanitizeSegment).filter(Boolean).join('/');
    return safe ? join(kind, safe) : null;
}

/**
 * Remember an asset so it gets downloaded before rendering. `width`/`height`
 * from the export are a fallback for image formats we cannot measure ourselves.
 */
function registerAsset(rawSrc: string | null | undefined, kind: AssetKind, node?: HTMLElement): void {
    const url = originalImageUrl(fixUrl(rawSrc));
    if (!url || assets.has(url)) return;
    const file = localAssetFile(url, kind);
    if (!file) return;

    const width = Number(node?.getAttribute('width'));
    const height = Number(node?.getAttribute('height'));
    assets.set(url, {
        url,
        kind,
        file,
        route: `/${file}`.replaceAll('\\', '/'),
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null,
        downloaded: false,
    });
}

/** Only Ghost's own uploads are linked files: other links stay external links. */
function isGhostUpload(url: string): boolean {
    return /\/content\/(?:media|files)\//.test(url);
}

/** Collect every asset in a post: images, video/audio and linked documents. */
function registerAssets(root: HTMLElement): void {
    for (const img of root.querySelectorAll('img')) {
        // Bookmark cards become a plain link, so their thumbnail and favicon are never rendered.
        if (img.closest('.kg-bookmark-card')) continue;
        registerAsset(img.getAttribute('src'), 'images', img);
    }
    for (const el of root.querySelectorAll('[data-kg-thumbnail]')) {
        registerAsset(el.getAttribute('data-kg-thumbnail'), 'images');
    }
    for (const player of root.querySelectorAll('video, audio, source')) {
        registerAsset(player.getAttribute('poster'), 'images');
        registerAsset(player.getAttribute('src'), 'media');
    }
    for (const anchor of root.querySelectorAll('a[href]')) {
        const href = fixUrl(anchor.getAttribute('href'));
        if (isGhostUpload(href)) registerAsset(href, 'files');
    }
}

async function downloadAsset(asset: Asset): Promise<void> {
    const target = join(publicDir, asset.file);
    let body: Buffer;

    if (existsSync(target)) {
        body = readFileSync(target); // already downloaded by an earlier run
    } else {
        const response = await fetch(asset.url);
        if (!response.ok) {
            failedAssets.push(`${asset.url} (HTTP ${response.status})`);
            return;
        }
        body = Buffer.from(await response.arrayBuffer());
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, body);
    }

    asset.downloaded = true;
    if (asset.kind !== 'images') return;

    const size = readImageSize(body);
    if (size) {
        asset.width = size.width;
        asset.height = size.height;
    }
}

async function downloadAssets(): Promise<void> {
    const queue = [...assets.values()];
    if (queue.length === 0) return;

    console.log(`  Downloading ${queue.length} asset(s) to ${publicDir} ...`);
    const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, queue.length) }, async () => {
        for (let asset = queue.pop(); asset; asset = queue.pop()) {
            try {
                await downloadAsset(asset);
            } catch (error) {
                failedAssets.push(`${asset.url} (${error instanceof Error ? error.message : String(error)})`);
            }
        }
    });
    await Promise.all(workers);
}

function countDownloaded(kind: AssetKind): number {
    return [...assets.values()].filter(asset => asset.kind === kind && asset.downloaded).length;
}

// --- Intrinsic image size ---------------------------------------------------
// The site renders an image at its intrinsic size (shrinking it when the column
// is narrower), so we need the real pixel size of every downloaded file.

interface ImageSize { width: number; height: number }

function readImageSize(buffer: Buffer): ImageSize | null {
    if (buffer.length < 16) return null;
    if (buffer.readUInt32BE(0) === 0x89504E47) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }; // PNG (IHDR)
    }
    if (buffer.toString('latin1', 0, 3) === 'GIF') {
        return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        return readJpegSize(buffer);
    }
    if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
        return readWebpSize(buffer);
    }
    if (buffer.toString('utf8', 0, 512).includes('<svg')) {
        return readSvgSize(buffer.toString('utf8'));
    }
    return null;
}

function readJpegSize(buffer: Buffer): ImageSize | null {
    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xFF) {
            offset++;
            continue;
        }
        const marker = buffer[offset + 1];
        // Padding and standalone markers carry no length.
        if (marker === 0xFF || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) {
            offset += 2;
            continue;
        }
        // SOF0-SOF15 hold the frame size; C4/C8/CC are tables, not frames.
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    return null;
}

function readWebpSize(buffer: Buffer): ImageSize | null {
    switch (buffer.toString('latin1', 12, 16)) {
        case 'VP8 ':
            return { width: buffer.readUInt16LE(26) & 0x3FFF, height: buffer.readUInt16LE(28) & 0x3FFF };
        case 'VP8L': {
            const bits = buffer.readUInt32LE(21);
            return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
        }
        case 'VP8X':
            return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
        default:
            return null;
    }
}

function readSvgSize(svg: string): ImageSize | null {
    const width = Number.parseFloat(svg.match(/\bwidth="([\d.]+)(?:px)?"/)?.[1] ?? '');
    const height = Number.parseFloat(svg.match(/\bheight="([\d.]+)(?:px)?"/)?.[1] ?? '');
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) };

    const viewBox = svg.match(/\bviewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/[\s,]+/);
    if (viewBox?.length === 4) {
        const [, , boxWidth, boxHeight] = viewBox.map(Number);
        if (boxWidth > 0 && boxHeight > 0) return { width: Math.round(boxWidth), height: Math.round(boxHeight) };
    }
    return null;
}

// --- Inline (phrasing) rendering -------------------------------------------

function renderInline(nodes: Node[]): string {
    return nodes.map(renderInlineNode).join('');
}

function renderInlineNode(node: Node): string {
    if (isText(node)) return escapeInline(decodeEntities(node.rawText));
    if (!isElement(node)) return '';

    const inner = () => renderInline(node.childNodes);
    switch (tag(node)) {
        case 'STRONG':
        case 'B': {
            const t = inner();
            return t.trim() ? `**${t}**` : t;
        }
        case 'EM':
        case 'I': {
            const t = inner();
            return t.trim() ? `*${t}*` : t;
        }
        case 'DEL':
        case 'S':
        case 'STRIKE': {
            const t = inner();
            return t.trim() ? `~~${t}~~` : t;
        }
        case 'CODE': {
            const code = decodeEntities(node.rawText).trim();
            const fence = code.includes('`') ? '``' : '`';
            return `${fence}${code}${fence}`;
        }
        case 'A': {
            const href = assetUrl(node.getAttribute('href'));
            const label = inner().trim() || href;
            return href ? `[${label}](${href})` : label;
        }
        case 'BR':
            return '  \n';
        case 'IMG':
            return renderImage(node);
        default:
            // span, u, mark, sub, sup, ... -> keep text
            return inner();
    }
}

// --- Block rendering --------------------------------------------------------

function renderBlocks(nodes: Node[]): string {
    const out: string[] = [];
    for (const node of nodes) {
        const block = renderBlock(node);
        if (block && block.trim()) out.push(block.trim());
    }
    return out.join('\n\n');
}

function renderBlock(node: Node): string {
    if (isText(node)) {
        const text = escapeInline(decodeEntities(node.rawText)).trim();
        return text;
    }
    if (!isElement(node)) return '';

    switch (tag(node)) {
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
            const level = Number(tag(node)[1]);
            return `${'#'.repeat(level)} ${renderInline(node.childNodes).trim()}`;
        }
        case 'P': {
            const text = renderInline(node.childNodes).trim();
            return text;
        }
        case 'UL': return renderList(node, false, 0);
        case 'OL': return renderList(node, true, 0);
        case 'BLOCKQUOTE': return prefixLines(renderBlocks(node.childNodes), '> ');
        case 'PRE': return renderCode(node);
        case 'HR': return '---';
        case 'TABLE': return renderTable(node);
        case 'FIGURE': return renderFigure(node);
        case 'DIV': return renderDiv(node);
        default: return renderBlocks(node.childNodes);
    }
}

function prefixLines(text: string, prefix: string): string {
    return text.split('\n').map(line => (line ? prefix + line : prefix.trimEnd())).join('\n');
}

function renderList(node: HTMLElement, ordered: boolean, depth: number): string {
    const indent = '  '.repeat(depth);
    const lines: string[] = [];
    let index = 0;
    for (const li of node.childNodes) {
        if (!isElement(li) || tag(li) !== 'LI') continue;
        index++;
        const inlineParts: Node[] = [];
        const nestedLists: HTMLElement[] = [];
        for (const child of li.childNodes) {
            if (isElement(child) && (tag(child) === 'UL' || tag(child) === 'OL')) nestedLists.push(child);
            else inlineParts.push(child);
        }
        const marker = ordered ? `${index}.` : '-';
        const text = renderInline(inlineParts).trim();
        lines.push(`${indent}${marker} ${text}`);
        for (const nested of nestedLists) {
            lines.push(renderList(nested, tag(nested) === 'OL', depth + 1));
        }
    }
    return lines.join('\n');
}

function renderCode(node: HTMLElement): string {
    // node-html-parser treats <pre> as a raw-text element, so the inner <code>
    // is not parsed into a child node: work off the raw inner HTML string.
    let raw = node.rawText;
    const langMatch = raw.match(/(?:language|lang)-([\w-]+)/);
    const lang = langMatch ? langMatch[1] : '';
    raw = raw.replace(/^\s*<code[^>]*>/i, '').replace(/<\/code>\s*$/i, '');
    const code = decodeEntities(raw).replace(/\n+$/, '');
    return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function renderTable(node: HTMLElement): string {
    const rows = node.querySelectorAll('tr');
    if (rows.length === 0) return '';
    const cell = (el: HTMLElement) => renderInline(el.childNodes).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').trim();
    const matrix = rows.map(row =>
        row.querySelectorAll('th, td').map(cell),
    );
    const width = Math.max(...matrix.map(r => r.length));
    const pad = (r: string[]): string[] => [...r, ...Array(Math.max(0, width - r.length)).fill('')];
    const header = pad(matrix[0]);
    const body = matrix.slice(1).map(pad);
    const lines = [
        `| ${header.join(' | ')} |`,
        `| ${header.map(() => '---').join(' | ')} |`,
        ...body.map(r => `| ${r.join(' | ')} |`),
    ];
    return lines.join('\n');
}

function renderImage(node: HTMLElement): string {
    return renderImageUrl(node.getAttribute('src'), (node.getAttribute('alt') ?? '').replace(/[[\]]/g, ''));
}

/**
 * Renders a local image with its intrinsic size as MDC attributes. Without a
 * width the docs site stretches the image to the full column width, which blows
 * small screenshots up; with one it renders at most at its own size.
 */
function renderImageUrl(rawSrc: string | null | undefined, alt = ''): string {
    const url = originalImageUrl(fixUrl(rawSrc));
    if (!url) return '';

    const asset = assets.get(url);
    if (!asset?.downloaded) return `![${alt}](${url})`;

    const attributes = [
        asset.width ? `width="${asset.width}"` : '',
        asset.height ? `height="${asset.height}"` : '',
    ].filter(Boolean);
    return `![${alt}](${asset.route})${attributes.length ? `{${attributes.join(' ')}}` : ''}`;
}

/** The local path of a downloaded asset; unknown URLs are returned unchanged. */
function assetUrl(rawSrc: string | null | undefined): string {
    const url = originalImageUrl(fixUrl(rawSrc));
    const asset = assets.get(url);
    return asset?.downloaded ? asset.route : url;
}

function renderFigure(node: HTMLElement): string {
    const caption = node.querySelector('figcaption');
    const captionMd = caption ? renderInline(caption.childNodes).trim() : '';

    // Bookmark card -> link to the title.
    if (hasClass(node, 'kg-bookmark-card')) {
        const anchor = node.querySelector('a.kg-bookmark-container') ?? node.querySelector('a');
        const href = assetUrl(anchor?.getAttribute('href'));
        const title = node.querySelector('.kg-bookmark-title')?.text?.trim() || href;
        return href ? `[${title}](${href})` : '';
    }

    // Video card -> HTML5 video.
    if (hasClass(node, 'kg-video-card')) {
        const video = node.querySelector('video');
        const src = assetUrl(video?.getAttribute('src') ?? video?.querySelector('source')?.getAttribute('src'));
        const poster = assetUrl(node.getAttribute('data-kg-thumbnail') ?? video?.getAttribute('poster'));
        const posterAttr = poster ? ` poster="${poster}"` : '';
        const tagHtml = src ? `<video controls src="${src}"${posterAttr}></video>` : '';
        return captionMd ? `${tagHtml}\n\n*${captionMd}*` : tagHtml;
    }

    // Embed card (YouTube, etc.) -> keep the iframe.
    if (hasClass(node, 'kg-embed-card')) {
        const iframe = node.querySelector('iframe');
        const src = fixUrl(iframe?.getAttribute('src'));
        const html = src ? `<iframe src="${src}" frameborder="0" allowfullscreen></iframe>` : '';
        return captionMd ? `${html}\n\n*${captionMd}*` : html;
    }

    // Gallery card -> a series of images.
    if (hasClass(node, 'kg-gallery-card')) {
        const images = node.querySelectorAll('img').map(renderImage).filter(Boolean);
        return [images.join('\n\n'), captionMd ? `*${captionMd}*` : ''].filter(Boolean).join('\n\n');
    }

    // Default figure: an image with an optional caption.
    const img = node.querySelector('img');
    const imageMd = img ? renderImage(img) : renderBlocks(node.childNodes);
    return captionMd ? `${imageMd}\n\n*${captionMd}*` : imageMd;
}

function renderDiv(node: HTMLElement): string {
    // Callout card -> Docus semantic callout, picked from the Ghost colour.
    if (hasClass(node, 'kg-callout-card')) {
        const text = renderInline(node.querySelector('.kg-callout-text')?.childNodes ?? []).trim();
        if (!text) return '';
        const cls = node.getAttribute('class') ?? '';
        const component = /-(?:yellow|orange)/.test(cls)
            ? 'warning'
            : /-red/.test(cls)
                ? 'caution'
                : /-green/.test(cls)
                    ? 'tip'
                    : 'note'; // blue, grey, white, pink, purple, accent, default
        return `::${component}\n${text}\n::`;
    }

    // Button card -> a standalone link.
    if (hasClass(node, 'kg-button-card')) {
        const anchor = node.querySelector('a');
        const href = assetUrl(anchor?.getAttribute('href'));
        const label = anchor?.text?.trim() || href;
        return href ? `[${label}](${href})` : '';
    }

    // Toggle card -> a collapsible <details> block.
    if (hasClass(node, 'kg-toggle-card')) {
        const heading = node.querySelector('.kg-toggle-heading-text')?.text?.trim() ?? 'Details';
        const content = renderBlocks(node.querySelector('.kg-toggle-content')?.childNodes ?? []);
        return `<details>\n<summary>${heading}</summary>\n\n${content}\n\n</details>`;
    }

    // File card -> a link to the file.
    if (hasClass(node, 'kg-file-card')) {
        const anchor = node.querySelector('a');
        const href = assetUrl(anchor?.getAttribute('href'));
        const title = node.querySelector('.kg-file-card-title')?.text?.trim() || anchor?.text?.trim() || href;
        return href ? `[${title}](${href})` : '';
    }

    // Header card -> heading + optional subheading + optional button.
    if (hasClass(node, 'kg-header-card')) {
        const heading = node.querySelector('.kg-header-card-heading')?.text?.trim();
        const sub = node.querySelector('.kg-header-card-subheading')?.text?.trim();
        const anchor = node.querySelector('a');
        const href = assetUrl(anchor?.getAttribute('href'));
        return [
            heading ? `## ${heading}` : '',
            sub ?? '',
            href ? `[${anchor?.text?.trim() || href}](${href})` : '',
        ].filter(Boolean).join('\n\n');
    }

    // Unknown div -> unwrap and render its children.
    return renderBlocks(node.childNodes);
}

// --- Frontmatter ------------------------------------------------------------

function yamlString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function buildFrontmatter(post: GhostPost, description: string): string {
    // Docus derives the route and sidebar order from the file path, so we only
    // need the human-facing title and description here. The description is
    // always written, even when empty: Nuxt Content otherwise falls back to the
    // first paragraph of the body and renders it twice (as lead and as text).
    return [
        '---',
        `title: ${yamlString(post.title)}`,
        `description: ${yamlString(description)}`,
        '---',
    ].join('\n');
}

/**
 * Ghost shows `custom_excerpt` above the article, and authors usually repeat it
 * as the opening paragraph. The docs site renders the description itself, so
 * drop that paragraph instead of showing the same sentence twice.
 */
function stripDescriptionParagraph(root: HTMLElement, description: string): void {
    if (!description) return;
    const first = root.childNodes.find(node => (isElement(node) && tag(node) !== 'BR') || (isText(node) && node.rawText.trim()));
    if (!first || !isElement(first) || tag(first) !== 'P') return;
    if (normalizeWhitespace(decodeEntities(first.text)) !== description) return;
    root.removeChild(first);
}

function sectionIcon(tag: GhostTag): string {
    // TO DO pick icon for each tag
    return 'i-lucide-book-open';
}

function sectionTitle(tag: GhostTag): string {
    // "1. Tag Name" -> "Tag Name"
    return tag.name.replace(/^\d+\.\s*/, '').trim();
}

function sectionOrder(tag: GhostTag): number {
    // "1. Tag Name" -> 1, "🐛 Foo" -> 0, "Foo" -> Number.MAX_SAFE_INTEGER
    const match = tag.name.match(/^(\d+)\./);
    if (match) return Number(match[1]);
    if (/^[^a-z]/i.test(tag.name)) return 0;
    return Number.MAX_SAFE_INTEGER;
}

/** total < 10 -> 1, 2, ...; total >= 10 -> 01, 02, ... ; total <= 100 -> 001, 002, ... ; etc... */
function orderPrefix(index: number, total: number): string {
    return String(index + 1).padStart(String(total).length, '0');
}

// --- Main -------------------------------------------------------------------

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2));
    baseUrl = BASE_URL.replace(/\/$/, '');

    // --clean is destructive, so confirm before wiping (both clean-only and
    // clean-then-import go through here).
    if (opts.clean) {
        if (!(await confirmClean(opts.yes))) {
            console.log('Aborted.');
            return;
        }
        cleanContentDir();
        console.log();
        console.log(`✔ Cleaned ${contentDir}.`);
        if (!opts.input) return; // clean-only: nothing to import
    }

    if (!opts.input) return; // parseArgs guarantees input here, but keep TS happy

    if (!existsSync(opts.input)) {
        console.error(`✖ Ghost export not found at: ${opts.input}`);
        process.exit(1);
    }

    const data = readExport(opts.input);
    const tagById = new Map(data.tags.map(t => [t.id, t]));

    // post_id -> ordered, non-internal tags (first one is the "primary" tag).
    const tagsByPost = new Map<string, GhostTag[]>();
    const links = [...data.posts_tags].sort((a, b) => a.sort_order - b.sort_order);
    for (const link of links) {
        const t = tagById.get(link.tag_id);
        if (!t || t.slug.startsWith('hash-') || t.name.startsWith('#')) continue;
        const list = tagsByPost.get(link.post_id) ?? [];
        list.push(t);
        tagsByPost.set(link.post_id, list);
    }

    // Group published posts by their primary tag (untagged -> "overig").
    const OVERIG: GhostTag = { id: '', slug: 'overig', name: 'Overig' };
    const sections = new Map<string, { tag: GhostTag; posts: GhostPost[] }>();
    let skipped = 0;
    for (const post of data.posts) {
        if (post.type !== 'post' || post.status !== 'published') {
            skipped++;
            continue;
        }
        const primary = tagsByPost.get(post.id)?.[0] ?? OVERIG;
        const section = sections.get(primary.slug) ?? { tag: primary, posts: [] };
        section.posts.push(post);
        sections.set(primary.slug, section);
    }

    const orderedSections = [...sections.values()].sort((a, b) =>
        (sectionOrder(a.tag) - sectionOrder(b.tag)),
    );
    for (const section of orderedSections) {
        section.posts.sort((a, b) => (a.published_at ?? '').localeCompare(b.published_at ?? ''));
    }

    const unhandledCards = new Set<string>();
    let written = 0;
    const plaintextOnly: string[] = []; // track posts that don't have any HTML

    // Parse first: rendering needs the local path and intrinsic size of every
    // image, so all of them have to be downloaded before we write any markdown.
    const parsed = orderedSections.map(section => ({
        section,
        posts: section.posts.map((post) => {
            const root = parse(post.html ?? '', { comment: false });
            const description = normalizeWhitespace(decodeEntities(post.custom_excerpt ?? ''));
            stripDescriptionParagraph(root, description);
            registerAssets(root);
            for (const el of root.querySelectorAll('[class*="kg-"]')) {
                for (const cls of el.classList.values()) {
                    if (/^kg-[a-z]+-card$/.test(cls)) unhandledCards.add(cls);
                }
            }
            return { post, root, description };
        }),
    }));

    await downloadAssets();

    parsed.forEach(({ section, posts }, sectionIndex) => {
        const dir = join(contentDir, `${orderPrefix(sectionIndex, parsed.length)}.${section.tag.slug}`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, '.navigation.yml'),
            `title: ${sectionTitle(section.tag)}\nicon: ${sectionIcon(section.tag)}\n`,
            'utf8',
        );

        posts.forEach(({ post, root, description }, postIndex) => {
            const body = renderBlocks(root.childNodes) || (post.plaintext ?? '').trim();
            if (!post.html?.trim() && body) plaintextOnly.push(post.slug);
            const file = join(dir, `${orderPrefix(postIndex, posts.length)}.${post.slug}.md`);
            writeFileSync(file, `${buildFrontmatter(post, description)}\n\n${body}\n`, 'utf8');
            written++;
        });
    });

    // Card types we know and handle correctly. Some ()
    // kg-image-card, kg-code-card are handled by the generic figure/<pre> fallback.
    const known = new Set([
        'kg-callout-card', 'kg-button-card', 'kg-toggle-card', 'kg-file-card', 'kg-header-card',
        'kg-bookmark-card', 'kg-video-card', 'kg-embed-card', 'kg-gallery-card', 'kg-image-card', 'kg-code-card',
    ]);
    const unknown = [...unhandledCards].filter(c => !known.has(c));

    console.log();
    console.log(`✔ Migration complete.`);
    console.log(`  Written:  ${written} post(s) in ${parsed.length} section(s) -> ${contentDir}`);
    console.log(`  Uploads:  ${countDownloaded('images')} image(s), ${countDownloaded('media')} video/audio, ${countDownloaded('files')} file(s) -> ${publicDir}`);
    console.log(`  Skipped:  ${skipped} (drafts/non-posts)`);
    if (failedAssets.length) {
        console.log(`  ⚠ ${failedAssets.length} upload(s) could not be downloaded and still point at the old site:`);
        for (const failure of failedAssets) console.log(`    ${failure}`);
    }
    if (unknown.length) console.log(`  ⚠ Unhandled Ghost cards (review manually): ${unknown.join(', ')}`);
    if (plaintextOnly.length) {
        console.log(`  ⚠ ${plaintextOnly.length} post(s) had no rendered HTML, so all formatting was lost`);
        console.log(`    (imported as plaintext): ${plaintextOnly.join(', ')}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
