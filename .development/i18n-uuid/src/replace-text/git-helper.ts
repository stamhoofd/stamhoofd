import { execSync } from 'child_process';
import { globals } from '../shared/globals';

export interface GetGitChangesOptions {
    // ids of commits to compare
    compare?: [string, string]
}

export function getChanges(filePath: string, options: GetGitChangesOptions = {}) {
    const compareText = options.compare ? `${options.compare[0]} ${options.compare[1]} ` : '';
    const command = `git diff -U0 ${compareText}${filePath}`;

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

export function getDiffChunks(filePath: string, options: GetGitChangesOptions = {}): DiffChunk[] | null {
    const changes = getChanges(filePath, options);
    const firstChunkIndex = changes.findIndex(isDiffChunkHeader);
    if(firstChunkIndex === -1) {
        return [];
    }

    const result = changes.slice(firstChunkIndex)
        .filter(isDiffChunkHeader)
        .map(getStartAndEndIndexFromDifChunkHeader);

        if(result.length === 1 && result[0].startIndex === -1) {
            return null;
        }

        return result;
}

export function getChangedLines(filePath: string, options: GetGitChangesOptions = {}): Set<number> | null {
    const diffChunks = getDiffChunks(filePath, options);
    if(diffChunks === null) {
        return null;
    }

    const changedLines = new Set<number>();

    for(const diffChunk of diffChunks) {
        for(let i = diffChunk.startIndex; i <= diffChunk.endIndex; i++) {
            changedLines.add(i);
        }
    }

    return changedLines;
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
    
    const diffOutput = execSync(command).toString();
    return new Set(diffOutput.toString().split('\n').map(file => root + '/' + file).filter(file => file.endsWith(extensionWithDot)));
}

export const startChangeMarker = '[[start-change]]';
export const endChangeMarker = '[[end-change]]';

function splitLines(text: string): string[] {
    return text.split(/(\r|\n)/).filter(item => !/(\r|\n)/.test(item));
}

export function addChangeMarkers(filePath: string, text: string, commitsToCompare?: [string, string]): string | null {
    const lines = splitLines(text);
    const changes = getDiffChunks(filePath, {compare: commitsToCompare});

    if(changes === null) {
        return null;
    }

    for(const {startIndex, endIndex} of changes) {
        lines[startIndex] = startChangeMarker + lines[startIndex];
        lines[endIndex] = lines[endIndex] + endChangeMarker;
    }

    return lines.join(`
`);
}

export function removeChangeMarkers(text: string): string {
    text = text.replaceAll(startChangeMarker, '');
    text = text.replaceAll(endChangeMarker, '');
    return text;
}

