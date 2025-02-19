import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";
import { escapeRegExp } from "./regex-helper";

// const regex = /(?<=<.+>)(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>)/ig;

const regex = /(?<=<.*(\w|"|')>|}})(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>|{{)/ig;

const templateRegex = /<template>((.|\n)+)<\/template>/;

// todo: update regex with $t('') etc
// todo: search all .html and .vue files for text to replace?
// -> do same as other code

function isNumberOrSpecialCharacter(value: string) {
    return /(^-?\d+$)|(^-?[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~]+$)/.test(value);
}

export function replaceVueTemplateText() {
    const files = getFilesToSearch(['vue']);


    for (const filePath of files) {
        console.log('- '+filePath);

        const fileContent = fs.readFileSync(filePath, "utf8");
        let newContent = fileContent;

        const templateArray = templateRegex.exec(fileContent);
        if(templateArray === null) {
            continue;
        }
        const template = templateArray[1]
        if(template === null) {
            continue;
        }

        let matches: RegExpExecArray | null;

        while ((matches = regex.exec(template)) !== null) {
            for(const match of matches) {
                if(!match) {
                    continue;
                }
                const trimmedMatch = match.trim();
                
                if(trimmedMatch.length === 0) {
                    continue;
                }

                if(trimmedMatch.startsWith('{{'))
                {
                    continue
                }

                const replaceRegex = new RegExp(`(?<=<.*(\\w|"|')>|}})${escapeRegExp(match)}(?=<.*\/.+.?>|{{)`, 'ig');

                let newLines: string[] = [];

                for(const line of match.split(/\r|\n/)) {
                    const trimmedLine = line.trim();
                
                    if(trimmedLine.length < 2) {
                        continue;
                    }

                    if(isNumberOrSpecialCharacter(trimmedLine)) {
                        continue;
                    }
    
                    let bracketType = "'";
                    let replaceValue = line.trimStart();
    
                    if(line.includes("'")) {
                        bracketType = line.includes('"') ? '`' : '"';
                    } else if(line.includes('"')) {
                        bracketType = '`';
                    }

                    newLines.push(`{{$t(${bracketType}${replaceValue}${bracketType})}}`);
                }

                if(!newLines.length) {
                    continue;
                }

                const replaceValue = newLines.join("\r\n");

                newContent = newContent.replace(replaceRegex, replaceValue);
            }
        }

        if(fileContent !== newContent) {
            console.log('Replaced keys in ' + filePath);
            fs.writeFileSync(filePath, newContent);
        }
    }
}
