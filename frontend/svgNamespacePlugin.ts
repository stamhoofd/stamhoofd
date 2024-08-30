export default function svgNamespacePlugin(options: {namespace: string}): import('vite').Plugin {  
    const name = 'svg-namespace-plugin';    
    if (!options.namespace) {
        return {
            name
        };
    }

    return {
        enforce: 'pre', // load before other plugins
        name,
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
