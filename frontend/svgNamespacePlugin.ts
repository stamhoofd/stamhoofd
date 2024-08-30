import fs from 'fs';
import path from 'path';

// wip: color replacements
const builtInColorNames: Record<string, string[]> = {
    'primary': [
        '#0053FF',
        '#0053ff'
    ],
    'primarySlightlyDarker': [
        '#0046D7'
    ],
    'primaryDarker': [
        '#002573'
    ],
    'red': [
        '#FF1741'
    ],
    'warning': [
        '#FFC900'
    ]
};

function replaceSource(id: string, source: string, options: {namespace: string, colors?: Record<string, `#${string}`>}) {
    if (options.colors && id.endsWith('.svg') && id.includes('/assets/images/illustrations/')) {
        let newCode = source;
        for (const [colorName, replaceColorValue] of Object.entries(options.colors ?? {})) {
            if (!(colorName in builtInColorNames)) {
                throw new Error('Unknown color name: ' + colorName);
            }

            for (const colorCode of builtInColorNames[colorName]) {
                newCode = newCode.replace(new RegExp(colorCode, 'g'), replaceColorValue);
            }
        }

        if (newCode !== source) {
            return newCode;
        }
    }
}


export default function svgNamespacePlugin(options: {namespace: string, colors?: Record<string, `#${string}`>}): import('vite').Plugin[] {  
    const name = 'svg-namespace-plugin';    
    let base: Partial<import('vite').Plugin> = {}
    
    if (options.namespace) {
        base = {
            async resolveId(source: string, importer: string|undefined, resolveOptions) {
                if (!importer) {
                    return null;
                }

                if (source.startsWith('@stamhoofd/assets/images/illustrations/')) { 
                    // Replace with namespace
                    const replaced = source.replace('@stamhoofd/assets/images/illustrations/', '@stamhoofd/assets/images/illustrations/'+options.namespace + '/')
                    
                    const resolved = await this.resolve(
                        replaced,
                        importer,
                        Object.assign({ skipSelf: true }, resolveOptions)
                    );

                    if (resolved) {
                        return resolved;
                    }

                    return null;
                }

                return null;
            }
        }
    }

    return [
        {
            enforce: 'pre', // load before other plugins
            name,
            apply: 'build',
    
            ...base,
            load(id) {
                if (options.colors && id.endsWith('.svg') && id.includes('/assets/images/illustrations/')) {    
                    const source = fs.readFileSync(id, 'utf-8');

                    const updatedSource = replaceSource(id, source, options)
                    if (updatedSource) {
                        const referenceId = this.emitFile({
                            type: 'asset',
                            name: path.basename(id),
                            source: updatedSource
                        });
                        return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
                    }
                }
            }
        },
        {
            enforce: 'pre', // load before other plugins
            name,
            apply: 'serve',
    
            ...base
            // todo: replace colors
        }
    ]
}
