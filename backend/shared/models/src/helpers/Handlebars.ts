
import { ObjectData } from "@simonbackx/simple-encoding";
import { Image } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import Handlebars from "handlebars";
import { Interval } from "luxon";

Handlebars.registerHelper('eq', (a, b) => a == b);
Handlebars.registerHelper('neq', (a, b) => a != b);
Handlebars.registerHelper('formatPrice', (a) => Formatter.price(a));
Handlebars.registerHelper('formatDate', (a, options) => {
    if (!(a instanceof Date)) {
        return ""
    }
    if (options.hash.format === 'DD-MM-YYYY') {
        return Formatter.dateNumber(a, true).replaceAll("/", "-");
    }
    return Formatter.dateNumber(a, true)
});

Handlebars.registerHelper('or', (...args) => {
    args.pop();
    return !!args.find(a => !!a)
});

Handlebars.registerHelper('and', (...args) => {
    args.pop();
    return args.every(a => !!a)
});

/**
 * Filter string for a given type
 */
Handlebars.registerHelper('filterString', (a, options) => {
    if (typeof a !== "string") {
        return ""
    }
    if (options.hash.type === "phone") {
        return Formatter.removeAccents(a).replace(/[^A-Za-z0-9\+]+/g, "")
    }
    // Default: alphanumeric
    return Formatter.removeAccents(a).replace(/[^A-Za-z0-9]+/g, "")
});
Handlebars.registerHelper('year', (a, options) => {
    if (!(a instanceof Date)) {
        return ""
    }
    return Formatter.year(a)
});

Handlebars.registerHelper('now', () => {
    return new Date();
});

Handlebars.registerHelper('coalesce', (...args) => {
    return args.find(a => a !== null && a !== undefined) ?? null
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
    if (typeof a !== "number" || typeof b !== "number") {
        return 0;
    }
    if (b == 0) {
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
    if (typeof obj === "number" && keys.length == 0) {
        return obj;
    }
    if (typeof obj !== "object" || obj === null) {
        return 0;
    }
    if (keys.length == 0) {
        return 0;
    }
    const key = keys[0]
    if (key === undefined) {
        return 0;
    }
    return getNumberValue(obj[key], keys.slice(1));
}
Handlebars.registerHelper('arraySum', (objects: any[], property) => {
    const keys = (property ?? "").split(".");
    return objects.reduce((c, obj) => getNumberValue(obj, keys) + c, 0);
});

Handlebars.registerHelper('mul', (a, b) => {
    if (typeof a !== "number" || typeof b !== "number") {
        return 0;
    }
    return a * b;
});

Handlebars.registerHelper('src', (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;
    try {
        const image = Image.decode(new ObjectData(a, {version: 0}));
        const resolution = image.getResolutionForSize(width, height);
        return resolution.file.getPublicPath()
    } catch (e) {
        console.error('src helper:', e);
        return "";
    }
});
Handlebars.registerHelper('src-width', (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;
    try {
        const image = Image.decode(new ObjectData(a, {version: 0}));
        const resolution = image.getResolutionForSize(width, height);
        return resolution.width;
    } catch (e) {
        console.error('src-width helper:', e);
        return 0;
    }
});
Handlebars.registerHelper('src-height', (a, options) => {
    const width = options.hash.width || undefined;
    const height = options.hash.height || undefined;
    try {
        const image = Image.decode(new ObjectData(a, {version: 0}));
        const resolution = image.getResolutionForSize(width, height);
        return resolution.height;
    } catch (e) {
        console.error('src-height helper:', e);
        return 0;
    }
});

// Rander handlebars template
export function render(htmlTemplate: string, context: any): string | null {
    try {
        const template = Handlebars.compile(htmlTemplate);
        const renderedHtml = template(context);
        return renderedHtml;
    } catch (e) {
        console.error('Failed to render document html', e)
        return null;
    }
}