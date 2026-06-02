import { Help } from '@oclif/core';
import type { Command, Interfaces } from '@oclif/core';
import { colorize } from '@oclif/core/ux';

type HelpExample = string | { command: string };

const rootGroups = [
    {
        header: 'RUNNING LOCALLY',
        ids: ['setup', 'services', 'dev', 'status', 'sso'],
    },
    {
        header: 'LOCAL STATE',
        ids: ['config', 'db', 'clean'],
    },
    {
        header: 'CODE',
        ids: ['build', 'check', 'test'],
    },
] as const;

export default class StamhoofdHelp extends Help {
    constructor(config: Interfaces.Config, opts?: Partial<Interfaces.HelpOptions>) {
        super(config, { ...opts, hideCommandSummaryInDescription: true });
    }

    protected override formatCommand(command: Command.Loadable): string {
        return compactExampleSpacing(super.formatCommand(command));
    }

    protected async showRootHelp(): Promise<void> {
        let rootTopics = this.sortedTopics;
        let rootCommands = this.sortedCommands;

        this.log(this.formatRoot());
        this.log('');

        if (!this.opts.all) {
            rootTopics = rootTopics.filter(topic => !topic.name.includes(':'));
            rootCommands = rootCommands.filter(command => !command.id.includes(':'));
        }

        const featuredIds = new Set<string>();

        for (const group of rootGroups) {
            const section = this.rootGroup(group.header, group.ids, rootTopics, rootCommands);
            if (!section) {
                continue;
            }

            this.log(section.section);
            this.log('');

            for (const id of section.ids) {
                featuredIds.add(id);
            }
        }

        rootTopics = rootTopics.filter(topic => !featuredIds.has(topic.name));
        rootCommands = rootCommands.filter(command => command.id && !featuredIds.has(command.id));

        const topicNames = new Set(rootTopics.map(topic => topic.name));
        rootCommands = rootCommands.filter(command => command.id && !topicNames.has(command.id));

        const otherCommands = this.otherCommands(rootTopics, rootCommands);
        if (otherCommands) {
            this.log(otherCommands);
            this.log('');
        }
    }

    protected async showTopicHelp(topic: Interfaces.Topic): Promise<void> {
        await super.showTopicHelp(topic);
        const examples = this.topicExamples(topic);
        if (examples) {
            this.log(examples);
        }
    }

    private rootGroup(header: string, groupIds: readonly string[], topics: Interfaces.Topic[], commands: Command.Loadable[]): { ids: string[]; section: string } | undefined {
        const topicByName = new Map(topics.map(topic => [topic.name, topic]));
        const commandById = new Map(commands.filter((command): command is Command.Loadable & { id: string } => Boolean(command.id)).map(command => [command.id, command]));
        const entries: Array<[string, string | undefined]> = [];
        const ids: string[] = [];

        for (const id of groupIds) {
            const topic = topicByName.get(id);
            if (topic) {
                entries.push([topic.name, topic.description?.split('\n')[0]]);
                ids.push(id);
                continue;
            }

            const command = commandById.get(id);
            if (command) {
                entries.push([command.id, command.summary]);
                ids.push(id);
            }
        }

        if (entries.length === 0) {
            return undefined;
        }

        return {
            ids,
            section: this.formatRootList(header, entries),
        };
    }

    private otherCommands(topics: Interfaces.Topic[], commands: Command.Loadable[]): string | undefined {
        const entries: Array<[string, string | undefined]> = [
            ...topics.map(topic => [topic.name, topic.description?.split('\n')[0]] as [string, string | undefined]),
            ...commands.map(command => [command.id, command.summary] as [string, string | undefined]),
        ];

        if (entries.length === 0) {
            return undefined;
        }

        return this.formatRootList('OTHER', entries);
    }

    private topicExamples(topic: Interfaces.Topic): string | undefined {
        const topicCommand = this.config.commands.find(command => command.id === topic.name);
        const examples = topicCommand?.examples;
        if (!examples || examples.length === 0) {
            return undefined;
        }

        const commands = Array.isArray(examples) ? examples : [examples];
        return this.section('EXAMPLES', commands.map(example => `$ ${formatExampleCommand(example)}`).join('\n'));
    }

    private formatRootList(header: string, entries: Array<[string, string | undefined]>): string {
        const body = this.renderList(entries.map(([name, summary]) => [
            colorize(this.config?.theme?.command, name),
            summary && colorize(this.config?.theme?.sectionDescription, summary),
        ]), {
            indentation: 2,
            spacer: '\n',
            stripAnsi: this.opts.stripAnsi,
        });

        return this.section(header, body);
    }
}

function compactExampleSpacing(help: string): string {
    return help.replace(/\n{2}(?= {2}\$ )/g, '\n');
}

function formatExampleCommand(example: HelpExample): string {
    return typeof example === 'string' ? example : example.command;
}
