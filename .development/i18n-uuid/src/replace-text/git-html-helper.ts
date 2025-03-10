import { getDiffChunks } from "./git-helper";

export const startChangeMarker = '[[start-change]]';
export const endChangeMarker = '[[end-change]]';

function splitLines(text: string): string[] {
    return text.split(/(\r|\n)/).filter(item => !/(\r|\n)/.test(item));
}

export function addChangeMarkers(filePath: string, text: string, commitsToCompare?: [string, string]): string {
    const lines = splitLines(text);
    const changes = getDiffChunks(filePath, {compare: commitsToCompare});

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
