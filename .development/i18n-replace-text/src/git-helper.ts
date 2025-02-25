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
    lineNumber: number;
    newLineValues: string[]
}

export interface DiffChunk2 {
    startIndex: number;
    endIndex: number;
}

export function getDiffChunks2(filePath: string): DiffChunk2[] {
    const changes = getChanges(filePath);
    const firstChunkIndex = changes.findIndex(isDiffChunkHeader);
    if(firstChunkIndex === -1) {
        return [];
    }

    return changes.slice(firstChunkIndex)
        .filter(isDiffChunkHeader)
        .map(getStartAndEndIndexFromDifChunkHeader);
}

export function getDiffChunks(filePath: string): DiffChunk[] {
    const changes = getChanges(filePath);
    const firstChunkIndex = changes.findIndex(isDiffChunkHeader);
    if(firstChunkIndex === -1) {
        return [];
    }

    let currentChunk: DiffChunk | null = null;
    const result: DiffChunk[] = [];

    for(let lineIndex = firstChunkIndex; lineIndex < changes.length; lineIndex++) {
        const line = changes[lineIndex];

        if(isDiffChunkHeader(line)) {
            currentChunk = {
                lineNumber: getLineNumberFromDiffChunkHeader(line),
                newLineValues: []
            }
            result.push(currentChunk);
            continue;
        }

        if(isChangedLine(line) && currentChunk) {
            currentChunk.newLineValues.push(getChangedLineValue(line));
        }
    }

    return result;
}

function isDiffChunkHeader(line: string): boolean {
    return line.startsWith('@@');
}

function getStartAndEndIndexFromDifChunkHeader(diffChunkHeader: string): DiffChunk2 {
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

function getLineNumberFromDiffChunkHeader(line: string): number {
    const matches = /\+[0-9]+/.exec(line);
    if(matches === null) {
        return -1;
    }

    return parseInt(matches[0].substring(1));
}

function isChangedLine(line: string): boolean {
    return line.startsWith('+');
}

function getChangedLineValue(line: string): string {
    return line.substring(1);
}

export function getChangedFiles(extension: string = ''): Set<string> {
    const root = globals.I18NUUID_ROOT;
    const extensionWithDot = '.'+extension;
//   const command = `git diff HEAD^ HEAD --name-only ${extensionFilter}`;
    const command = `git diff --name-only ${root}`;
  const diffOutput = execSync(command).toString();
  return new Set(diffOutput.toString().split('\n').map(file => root + '/' + file).filter(file => file.endsWith(extensionWithDot)));
}
