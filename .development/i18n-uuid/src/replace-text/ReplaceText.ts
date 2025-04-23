import { translateTypescriptFiles } from "./translate-typescript-files";
import { translateVueFiles } from "./translate-vue-files";

export interface ReplaceTextOptions {
    replaceChangesOnly?: boolean;
    doPrompt?: boolean;
    doFix?: boolean;
    dryRun?: boolean;
    commitsToCompare?: [string, string];
    attributeWhiteList?: Set<string>;
}

export interface ReplaceTextArgs {
    commits?: string[],
    changes?: boolean,
    attributes?: string[],
    dryRun?: boolean,
    prompt?: boolean,
    fix?: boolean,
}

export class ReplaceText {
    private readonly options: ReplaceTextOptions;

    constructor(args: ReplaceTextArgs){
        this.options = {
            replaceChangesOnly: args.changes ?? false,
            doPrompt: args.prompt ?? false,
            doFix: args.fix ?? false,
            dryRun: args.dryRun ?? false,
            attributeWhiteList: args.attributes ? new Set(args.attributes) : undefined,
            commitsToCompare: this.getCommitsToCompare(args.commits)
        }
    }

    async start() {
        await translateVueFiles(this.options);
        await translateTypescriptFiles(this.options);
    }

    private getCommitsToCompare(commits: string[] | undefined): [string, string] | undefined {
        if(commits === undefined) {
            return undefined;
        }

        if(commits.length > 2) {
            throw new Error(`Received more than two commits to compare: ${commits}`)
        }

        return commits as [string, string];
    }
}
