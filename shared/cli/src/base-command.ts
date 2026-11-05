import { Command, Flags } from '@oclif/core';
import type { Parser } from '@oclif/core';
import { createContext } from './context/create-context.js';
import type { CliContext } from './context/create-context.js';
import { RunVerbosity } from './runtime/command-runner.js';
import { withCliTelemetry } from './runtime/telemetry.js';

export abstract class BaseCommand extends Command {
    static verbosity: RunVerbosity = RunVerbosity.Command;

    private commandInput?: Parser.ParserOutput<any, any, any>;

    /** oclif owns error reporting and finally hooks; telemetry encloses that entire lifecycle. */
    protected override async _run<T>(): Promise<T> {
        const parsed = await this.parse(this.ctor);
        const command = this.ctor as typeof BaseCommand;
        const verbosity = this.resolveRunVerbosity({ quiet: parsed.flags.quiet, verbose: parsed.flags.verbose }, command.verbosity, parsed.raw);
        return withCliTelemetry(`stam.${(this.id ?? command.name).replaceAll(':', '.')}`, verbosity, () => super._run<T>());
    }

    protected override async parse<F extends Record<string, any>, B extends Record<string, any>, A extends Record<string, any>>(options?: Parser.Input<F, B, A>, argv = this.argv): Promise<Parser.ParserOutput<F, B, A>> {
        const ownInput = (!options || options === this.ctor) && argv === this.argv;
        if (ownInput && this.commandInput) return this.commandInput;
        const parsed = await super.parse(options, argv);
        if (ownInput) this.commandInput = parsed;
        return parsed;
    }

    static verboseFlags = {
        verbose: Flags.boolean({ char: 'v', description: 'Print extra diagnostics while running', default: false }),
    };

    static quietFlag = Flags.boolean({ description: 'Print fewer diagnostics while running', default: false });

    static verbosityFlags(verbosity: RunVerbosity = this.verbosity) {
        return {
            ...(verbosity === RunVerbosity.Quiet ? {} : { quiet: verbosity === RunVerbosity.Command ? Flags.boolean({ ...this.quietFlag, exclusive: ['verbose'] }) : this.quietFlag }),
            ...(verbosity === RunVerbosity.Output ? {} : { verbose: verbosity === RunVerbosity.Command ? Flags.boolean({ ...this.verboseFlags.verbose, exclusive: ['quiet'] }) : this.verboseFlags.verbose }),
        };
    }

    static environmentFlags = {
        env: Flags.string({ description: 'Environment to use, such as stamhoofd or keeo', default: 'stamhoofd' }),
        ...BaseCommand.verbosityFlags(),
    };

    static instanceFlags = {
        ...BaseCommand.environmentFlags,
        name: Flags.string({ description: 'Instance name to use instead of the inferred workspace name' }),
    };

    protected async parseWithContext<F extends Record<string, any>, B extends Record<string, any>, A extends Record<string, any>>(command: Parser.Input<F, B, A> & { verbosity: RunVerbosity }, parsed?: Parser.ParserOutput<F, B, A>): Promise<Parser.ParserOutput<F, B, A> & { context: CliContext }> {
        parsed ??= await this.parse(command);
        return { ...parsed, context: await this.createContext(parsed.flags as { env?: string; name?: string; quiet?: boolean; verbose?: boolean }, command.verbosity, parsed.raw) };
    }

    private async createContext(flags: { env?: string; name?: string; quiet?: boolean; verbose?: boolean }, verbosity: RunVerbosity, raw: { type: string; flag?: string }[]): Promise<CliContext> {
        const context = await createContext({
            env: flags.env ?? 'stamhoofd',
            instanceName: flags.name,
            verbose: flags.verbose ?? false,
        });
        return { ...context, verbosity: this.resolveRunVerbosity(flags, verbosity, raw) };
    }

    protected resolveRunVerbosity(flags: { quiet?: boolean; verbose?: boolean }, verbosity: RunVerbosity, raw: { type: string; flag?: string }[]): RunVerbosity {
        if (flags.quiet) {
            return Math.max(RunVerbosity.Quiet, verbosity - 1) as RunVerbosity;
        }
        const increases = raw.length ? raw.filter(token => token.type === 'flag' && token.flag === 'verbose').length : (flags.verbose ? 1 : 0);
        return Math.min(RunVerbosity.Output, verbosity + increases) as RunVerbosity;
    }
}
