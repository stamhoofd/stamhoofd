import bwipjs from '@bwip-js/node';
import { ObjectData } from '@simonbackx/simple-encoding';
import { Image } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import Handlebars from 'handlebars';
import { Interval } from 'luxon';

/**
 * Support for async helpers
 * Uses the same method as express-hbs
 * https://github.com/TryGhost/express-hbs
 */
class AsyncResolver {
    cacheIds: Map<string, Promise<string>> = new Map();

    static ID_PREFIX = '__aSyNcId__';
    static ID_ESCAPED_STRING = '<_'; // Detect whether the is is escaped or not
    counter = 0;

    static registerAsyncHelper(handlebars: typeof Handlebars, name: string, handler: (...args) => Promise<string>) {
        handlebars.registerHelper(name, function (...args) {
            const resolver = this.asyncResolver;
            if (!resolver) {
                throw new Error('Async helper called without resolver');
            }

            // Return an id instead
            resolver.counter += 1;
            const id = AsyncResolver.ID_PREFIX + AsyncResolver.ID_ESCAPED_STRING + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + '_' + resolver.counter;
            resolver.cacheIds.set(id, handler(...args));

            return id;
        });
    }

    async replace(compiledTemplate: string) {
        for (const [id, promise] of this.cacheIds.entries()) {
            const value = await promise;

            // Replace unescaped ids with the unescaped value
            compiledTemplate = compiledTemplate.replace(id, value);

            // Replace escaped ids with the escaped value
            compiledTemplate = compiledTemplate.replace(Handlebars.Utils.escapeExpression(id), Handlebars.Utils.escapeExpression(value));
        }

        return compiledTemplate;
    }
}

Handlebars.registerHelper('eq', (a, b) => a == b);
Handlebars.registerHelper('neq', (a, b) => a !== b);
Handlebars.registerHelper('formatPrice', a => typeof a === 'number' ? Formatter.price(a) : a);
Handlebars.registerHelper('formatDate', (a, options) => {
    if (!(a instanceof Date)) {
        return '';
    }
    if (options.hash.format === 'DD-MM-YYYY') {
        return Formatter.dateNumber(a, true).replaceAll('/', '-');
    }
    return Formatter.dateNumber(a, true);
});

Handlebars.registerHelper('or', (...args) => {
    args.pop();
    return !!args.find(a => !!a);
});

Handlebars.registerHelper('and', (...args) => {
    args.pop();
    return args.every(a => !!a);
});

/**
 * Filter string for a given type
 */
Handlebars.registerHelper('filterString', (a, options) => {
    if (typeof a !== 'string') {
        return '';
    }
    if (options.hash.type === 'phone') {
        return Formatter.removeAccents(a).replace(/[^A-Za-z0-9+]+/g, '');
    }
    if (options.hash.type === 'companyNumber') {
        // BE prefix not allowed
        return Formatter.removeAccents(a).replace(/[^0-9]+/g, '');
    }
    // Default: alphanumeric
    return Formatter.removeAccents(a).replace(/[^A-Za-z0-9]+/g, '');
});
Handlebars.registerHelper('year', (a) => {
    if (!(a instanceof Date)) {
        return '';
    }
    return Formatter.year(a);
});

Handlebars.registerHelper('now', () => {
    return new Date();
});

Handlebars.registerHelper('coalesce', (...args) => {
    return args.find(a => a !== null && a !== undefined) ?? null;
});

Handlebars.registerHelper('days', (a, b) => {
    if (!(a instanceof Date) || !(b instanceof Date)) {
        return 0;
    }
    // Calculate absolute amount of days between a and b
    const start = Formatter.luxon(a).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    const end = Formatter.luxon(b).set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    const diff = Interval.fromDateTimes(start, end);
    const days = diff.length('days');
    if (isNaN(days)) {
        return 0;
    }
    return days + 1;
});

Handlebars.registerHelper('div', (a, b, options) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
        return 0;
    }
    if (b === 0) {
        return 0;
    }
    if (options.hash.round) {
        return Math.round(a / b);
    }
    return a / b;
});

Handlebars.registerHelper('sum', (...args) => {
    args.pop();
    return args.reduce((a, b) => a + b, 0);
});

function getNumberValue(obj: any, keys: string[]): number {
    if (typeof obj === 'number' && keys.length == 0) {
        return obj;
    }
    if (typeof obj !== 'object' || obj === null) {
        return 0;
    }
    if (keys.length === 0) {
        return 0;
    }
    const key = keys[0];
    if (key === undefined) {
        return 0;
    }
    return getNumberValue(obj[key], keys.slice(1));
}
Handlebars.registerHelper('arraySum', (objects: any[], property) => {
    if (typeof property !== 'string') {
        console.warn('arraySum helper: property is not a string');
        return 0;
    }
    const keys = (property ?? '').split('.');
    return objects.reduce((c, obj) => getNumberValue(obj, keys) + c, 0);
});

Handlebars.registerHelper('mul', (a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number') {
        return 0;
    }
    return a * b;
});

AsyncResolver.registerAsyncHelper(Handlebars, 'src', async (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;

    if (width !== undefined && typeof width !== 'number') {
        console.error('src helper: width is not a number');
        return '';
    }

    if (height !== undefined && typeof height !== 'number') {
        console.error('src helper: height is not a number');
        return '';
    }

    try {
        const image = Image.decode(new ObjectData(a, { version: 0 }));
        const resolution = image.getResolutionForSize(width as number | undefined, height as number | undefined);

        // Private files cannot be used unless we have a signed url
        const fileWithSignedUrl = await resolution.file.withSignedUrl();
        if (fileWithSignedUrl) {
            return fileWithSignedUrl.getPublicPath();
        }

        return resolution.file.getPublicPath();
    }
    catch (e) {
        console.error('src helper:', e);
        return '';
    }
});
Handlebars.registerHelper('src-width', (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;

    if (width !== undefined && typeof width !== 'number') {
        console.error('src-width helper: width is not a number');
        return 0;
    }

    if (height !== undefined && typeof height !== 'number') {
        console.error('src-width helper: height is not a number');
        return 0;
    }

    try {
        const image = Image.decode(new ObjectData(a, { version: 0 }));
        const resolution = image.getResolutionForSize(width as number | undefined, height as number | undefined);
        return resolution.width;
    }
    catch (e) {
        console.error('src-width helper:', e);
        return 0;
    }
});
Handlebars.registerHelper('src-height', (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;

    if (width !== undefined && typeof width !== 'number') {
        console.error('src-height helper: width is not a number');
        return 0;
    }

    if (height !== undefined && typeof height !== 'number') {
        console.error('src-height helper: height is not a number');
        return 0;
    }

    try {
        const image = Image.decode(new ObjectData(a, { version: 0 }));
        const resolution = image.getResolutionForSize(width as number | undefined, height as number | undefined);
        return resolution.height;
    }
    catch (e) {
        console.error('src-height helper:', e);
        return 0;
    }
});

Handlebars.registerHelper('datamatrix', (a) => {
    if (typeof a !== 'string') {
        return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const svgCode = bwipjs.toSVG({
        bcid: 'datamatrix',
        text: a,
    } as any);

    // Base64 encode the string
    return 'data:image/svg+xml;base64,' + Buffer.from(svgCode).toString('base64');
});

// Rander handlebars template
export async function render(htmlTemplate: string, context: any): Promise<string | null> {
    try {
        const resolver = new AsyncResolver();

        const template = Handlebars.compile(htmlTemplate);
        const renderedHtml = template({ ...context, asyncResolver: resolver });
        const html = await resolver.replace(renderedHtml);
        return html;
    }
    catch (e) {
        console.error('Failed to render document html', e);
        return null;
    }
}
