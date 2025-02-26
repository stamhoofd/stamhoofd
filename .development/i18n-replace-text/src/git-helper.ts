import chalk from 'chalk';
import { execSync } from 'child_process';
import { globals } from './globals';

export interface GetGitChangesOptions {
    // ids of commits to compare
    compare?: [string, string]
}

export function getChanges(filePath: string, options: GetGitChangesOptions = {}) {
    const compareText = options.compare ? `${options.compare[0]} ${options.compare[1]} ` : '';
    const command = `git diff -U0 ${compareText}${filePath}`;
    console.log(chalk.cyan(command));

    const diffOutput = execSync(command).toString();

    return diffOutput.split('\n').filter(line => {
        if(!line) {
            return false;
        }
        return line.trim().length > 0
    });
}

export interface DiffChunk {
    startIndex: number;
    endIndex: number;
}

export function getDiffChunks(filePath: string, options: GetGitChangesOptions = {}): DiffChunk[] {
    const changes = getChanges(filePath, options);
    const firstChunkIndex = changes.findIndex(isDiffChunkHeader);
    if(firstChunkIndex === -1) {
        return [];
    }

    return changes.slice(firstChunkIndex)
        .filter(isDiffChunkHeader)
        .map(getStartAndEndIndexFromDifChunkHeader);
}

function isDiffChunkHeader(line: string): boolean {
    return line.startsWith('@@');
}

function getStartAndEndIndexFromDifChunkHeader(diffChunkHeader: string): DiffChunk {
    const match = diffChunkHeader.match(/\+([0-9]+),([0-9]+)/);

    if(match === null) {
        const match = diffChunkHeader.match(/\+([0-9]+)/);

        if(match === null) {
            throw new Error('Failed to read start and end index from diff chunk header, header: '+ diffChunkHeader);
        }

        const startIndex = parseInt(match[1]) - 1;
        const endIndex = startIndex;
    
        return {
            startIndex,
            endIndex
        }
    }

    const startIndex = parseInt(match[1]) - 1;
    const endIndex = startIndex + parseInt(match[2]) - 1;

    return {
        startIndex,
        endIndex
    }
}

export interface GetGitChangedFilesOptions {
    // ids of commits to compare
    compare?: [string, string]
}

export function getChangedFiles(extension: string = '', options: GetGitChangedFilesOptions = {}): Set<string> {
    const root = globals.I18NUUID_ROOT;
    const extensionWithDot = '.'+extension;

    const compareText = options.compare ? `${options.compare[0]} ${options.compare[1]} ` : '';
    const command = `git diff --name-only ${compareText}${root}`;
    console.log(chalk.cyan(command));
    const diffOutput = execSync(command).toString();
    return new Set(diffOutput.toString().split('\n').map(file => root + '/' + file).filter(file => file.endsWith(extensionWithDot)));
}
