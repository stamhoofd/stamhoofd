import chalk from "chalk";
import fs from "fs";
import { getDiffChunks2 } from "./git-helper";

export const startChangeMarker = '[[start-change]]';
export const endChangeMarker = '[[end-change]]';

function splitLines(text: string): string[] {
    return text.split(/(\r|\n)/).filter(item => !/(\r|\n)/.test(item));

}

export function testAddChangeMarkers() {
    const filePath = '/Users/bjarne/Projects/stamhoofd/frontend/app/dashboard/src/views/dashboard/receivable-balances/ReceivableBalancesTableView.vue';
    const fileContent = fs.readFileSync(filePath, "utf8");
    const withChangeMarkers = addChangeMarkers(filePath, fileContent);
    console.log(chalk.blue('with change markers: '))
    console.log(withChangeMarkers)
    const removed = removeChangeMarkers(withChangeMarkers);
    console.log(chalk.blue('removed: '))
    console.log(removed)
}

export function addChangeMarkers(filePath: string, text: string): string {
    const lines = splitLines(text);
    const changes = getDiffChunks2(filePath);

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
