import fs from "fs";
import { getFilesToSearch } from "./get-files-to-search";

// const regex = /(?<=<.+>)(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>)/ig;

const regex = /(?<=<.+>|}})(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?:\w|\d|\n|\s|\\n|[().,\-:;@#$%^&*\[\]"'+–/\/®°⁰!?{}|~])+?(?=<.*\/.+.?>|{{)/ig;

const templateRegex = /<template>((.|\n)+)<\/template>/;

// todo: update regex with $t('') etc
// todo: search all .html and .vue files for text to replace?
// -> do same as other code




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
                const trimmed = match.trim();
                if(trimmed.length === 0) {
                    continue;
                }
                if(trimmed.startsWith('{{'))
                {
                    continue
                }

                let bracketType = "'";

                if(match.includes("'")) {
                    bracketType = match.includes('"') ? '`' : '"';
                } else if(match.includes('"')) {
                    bracketType = '`';
                }

                newContent = newContent.replace(match, `{{$t(${bracketType}${match}${bracketType}}}`)
            }
        }

        if(fileContent !== newContent) {
            console.log('Replaced keys in ' + filePath);
            fs.writeFileSync(filePath, newContent);
        }

        // todo: replace match with {{$t(``)}} or {{$t('')}}
        

        // let matches: RegExpExecArray | null;
        // let hasMissingKey = false;

        // // Extract all matches
        // for(const regex of regexes) {
        //     while ((matches = regex.exec(fileContent)) !== null) {
        //         const key = matches[1];
    
        //         if (!translations[key]) {
        //             missingKeys.add(key);
        //             hasMissingKey = true;
        //         }
        //     }
        // }

        // if (hasMissingKey) {
        //     filesWithMissingKeys.add(filePath);
        // }
    }
}
