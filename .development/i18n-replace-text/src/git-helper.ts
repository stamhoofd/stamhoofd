import { execSync } from 'child_process';
import { globals } from './globals';

// todo: specify commit to compare
export function getChanges(filePath: string) {
    const command = `git diff -U0 ${filePath}`;
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

export function getDiffChunks(filePath: string): DiffChunk[] {
    const changes = getChanges(filePath);
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

export function getChangedFiles(extension: string = ''): Set<string> {
    const root = globals.I18NUUID_ROOT;
    const extensionWithDot = '.'+extension;

    const command = `git diff --name-only ${root}`;
    const diffOutput = execSync(command).toString();
    return new Set(diffOutput.toString().split('\n').map(file => root + '/' + file).filter(file => file.endsWith(extensionWithDot)));
}
