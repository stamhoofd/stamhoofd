export interface CliArguments {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    doFix?: boolean;
    dryRun?: boolean;
    commitsToCompare?: [string, string];
    attributeWhiteList?: Set<string>;
}

export function getCliArguments(): CliArguments {
    const args = process.argv.slice(2);

    const result: CliArguments = {};

    const compareFlag = '--compare';
    let isReadingCommitsToCompare = false;
    let commitsToCompare: undefined | string[] = undefined;

    const attributeWhiteListFlag = '--attribute-white-list';
    let isReadingAttributeWhiteList = false;

    for(const arg of args) {
        if(isReadingCommitsToCompare) {
            if(commitsToCompare === undefined) {
                commitsToCompare = [];
            }

            commitsToCompare.push(arg);

            if(commitsToCompare.length === 2) {
                isReadingCommitsToCompare = false;
                result.commitsToCompare = commitsToCompare as [string, string];
            }
            continue;
        }

        if(isReadingAttributeWhiteList) {
            isReadingAttributeWhiteList = false;
            const parsed = JSON.parse(arg);
            if(!Array.isArray(parsed)) {
                throw new Error('Attribute white list must be an array.');
            }

            parsed.forEach((value: string) => {
                if(typeof value !== 'string') {
                    throw new Error('Attribute white list must be an array of strings.');
                }
            });

            result.attributeWhiteList = new Set(parsed);
        }

        if(arg === attributeWhiteListFlag) {
            isReadingAttributeWhiteList = true;
            continue;
        }

        if(arg === compareFlag) {
            isReadingCommitsToCompare = true;
            continue;
        }

        if(arg === '--dry-run') {
            result.dryRun = true;
            continue;
        }

        if(arg === '--prompt') {
            result.doPrompt = true;
            continue;
        }

        if(arg === '--fix') {
            result.doFix = true;
            continue;
        }

        if(arg === '--changes') {
            result.replaceChangesOnly = true;
            continue;
        }

        throw new Error('Unknown argument: ' + arg);
    }

    return result;
}
