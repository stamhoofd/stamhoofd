import { CellAlignmentOptions, CellStyleRequest, FontOptions, NumberFormatOptions, XlsxBuiltInNumberFormat } from '../interfaces.js';
import { escapeXml } from './escapeXml.js';
import { XlsxFileWriter } from './XlsxFileWriter.js';

type CellStyle = {
    fontId?: number;
    numberFormatId?: number;
    alignment?: CellAlignmentOptions;
    applyNumberFormat?: boolean;
    applyFont?: boolean;
    applyAlignment?: boolean;
};

export class XlsxStylesWriter extends XlsxFileWriter {
    numberFormats: Required<NumberFormatOptions>[] = [];
    fonts: FontOptions[] = [];
    cellStyles: CellStyle[] = [];

    async requestNumberFormatId(options: NumberFormatOptions = {}): Promise<number> {
        if (options.id) {
            for (const o of this.numberFormats) {
                if (o.id === options.id) {
                    if (options.formatCode && o.formatCode !== options.formatCode) {
                        o.formatCode = options.formatCode;
                    }
                    return o.id;
                }
            }

            if (!options.formatCode) {
                if (Object.values(XlsxBuiltInNumberFormat).includes(options.id)) {
                    // Built in number format
                    return options.id;
                }

                throw new Error('Invalid number format id: ' + options.id + ', missing formatCode');
            }

            // Create a new one with this specific id
            this.numberFormats.push(options as Required<NumberFormatOptions>);
            return Promise.resolve(options.id);
        }

        if (!options.formatCode) {
            // No formatting requested
            // Return default style
            return XlsxBuiltInNumberFormat.Number;
        }

        // Check if we find a match
        for (const o of this.numberFormats) {
            if (o.id && o.formatCode && o.formatCode === options.formatCode) {
                return o.id;
            }
        }

        // Generate a new id
        const id = this.numberFormats.length + 164;
        this.numberFormats.push({ id, formatCode: options.formatCode });

        return id;
    }

    async requestFontId(options: FontOptions) {
        if (options.size === undefined) {
            options.size = 12;
        }

        if (options.bold === undefined) {
            options.bold = false;
        }

        // Checks whether this exists already, or creates it
        for (const [id, o] of this.fonts.entries()) {
            if (o.size === options.size && o.bold === options.bold) {
                return id;
            }
        }

        this.fonts.push(options);
        return Promise.resolve(this.fonts.length - 1);
    }

    async getCellStyle(style: CellStyleRequest): Promise<CellStyle> {
        return {
            fontId: await this.requestFontId(style.font ?? {}),
            numberFormatId: await this.requestNumberFormatId(style.numberFormat),
            alignment: style.alignment,
            applyNumberFormat: style.numberFormat ? true : undefined,
            applyFont: style.font ? true : false,
            applyAlignment: style.alignment ? true : false,
        };
    }

    alignmentEquals(a: CellAlignmentOptions, b: CellAlignmentOptions): boolean {
        return a.horizontal === b.horizontal && a.vertical === b.vertical && a.wrapText === b.wrapText;
    }

    styleEquals(a: CellStyle, b: CellStyle): boolean {
        return a.fontId === b.fontId
            && a.numberFormatId === b.numberFormatId
            && a.applyNumberFormat === b.applyNumberFormat
            && a.applyFont === b.applyFont
            && this.alignmentEquals(a.alignment || {}, b.alignment || {})
            && a.applyAlignment === b.applyAlignment;
    }

    async requestCellStyleId(request: CellStyleRequest): Promise<number> {
        const style = await this.getCellStyle(request);

        for (const [id, s] of this.cellStyles.entries()) {
            if (this.styleEquals(style, s)) {
                return id;
            }
        }

        this.cellStyles.push(style);
        return Promise.resolve(this.cellStyles.length - 1);
    }

    async close() {
        await this.write(`<?xml version="1.0" encoding="UTF-8"?>`);

        await this.write(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`);

        await this.write(`<numFmts count="${this.numberFormats.length}">`);

        for (const format of this.numberFormats) {
            await this.write(`<numFmt numFmtId="${escapeXml(format.id.toString())}" formatCode="${escapeXml(format.formatCode)}" />`);
        }

        await this.write(`</numFmts>`);

        await this.write(`<fonts count="${this.fonts.length}">`);

        for (const font of this.fonts) {
            await this.write(`<font>`);
            await this.write(`<name val="Aptos Narrow" />`);

            if (font.size) {
                await this.write(`<sz val="${escapeXml(font.size.toString())}" />`);
            }
            if (font.bold) {
                await this.write(`<b />`);
            }
            await this.write(`</font>`);
        }

        await this.write(`</fonts>`);

        await this.write(`<fills count="2">`);
        await this.write(`<fill><patternFill patternType="none" /></fill>`);
        await this.write(`<fill><patternFill patternType="gray125" /></fill>`);
        await this.write(`</fills>`);

        await this.write(`<borders count="1">`);
        await this.write(`<border><left /><right /><top /><bottom /><diagonal /></border>`);
        await this.write(`</borders>`);

        await this.write(`<cellStyleXfs count="1">`);
        await this.write(`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" />`);
        await this.write(`</cellStyleXfs>`);

        await this.write(`<cellXfs count="${this.cellStyles.length}">`);

        for (const style of this.cellStyles) {
            const attrs = `numFmtId="${style.numberFormatId}" fontId="${style.fontId}" fillId="0" borderId="0" xfId="0" applyNumberFormat="${style.applyNumberFormat ? 1 : 0}" applyFont="${style.applyFont ? 1 : 0}" applyAlignment="${style.applyAlignment ? 1 : 0}"`;

            if (style.alignment) {
                await this.write(`<xf ${attrs}>`);
                await this.write(`<alignment`);
                if (style.alignment.horizontal) {
                    await this.write(` horizontal="${style.alignment.horizontal}"`);
                }
                if (style.alignment.vertical) {
                    await this.write(` vertical="${style.alignment.vertical}"`);
                }
                if (style.alignment.wrapText) {
                    await this.write(` wrapText="1"`);
                }
                await this.write(` />`);
                await this.write(`</xf>`);
            }
            else {
                await this.write(`<xf ${attrs} />`);
            }
        }

        await this.write(`</cellXfs>`);

        await this.write(`<cellStyles count="1">`);
        await this.write(`<cellStyle name="Normal" xfId="0" builtinId="0" />`);
        await this.write(`</cellStyles>`);

        await this.write(`<dxfs count="0" />`);
        await this.write(`<tableStyles count="0" />`);

        await this.write(`</styleSheet>`);

        await super.close();
    }
}
