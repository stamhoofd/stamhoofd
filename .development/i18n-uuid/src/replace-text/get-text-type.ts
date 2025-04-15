export enum TextType {
    Key,
    FunctionArgument,
    Variable,
    Array,
    Equality,
    SwitchCase,
    Import
}

export function getTextType(allParts: {value: string}[] | string): {type: TextType, name: string | null} | null {
    const text = typeof allParts === 'string' ? allParts : allParts.map(p => p.value).join('');
    const lastCodePart = text.trimEnd().match(/(?<=(?:\s+))\S*$/g);
    if(lastCodePart) {
        const value = lastCodePart[0];

        if(value.endsWith('case')) {
            return {
                type: TextType.SwitchCase,
                name: null
            }
        }

        if(value.endsWith('from') || value.endsWith('import')) {
            return {
                type: TextType.Import,
                name: null
            }
        }

        if(['==', '!=', '>=', '<=', '<', '>'].some(item => value.endsWith(item))) {
            return {
                type: TextType.Equality,
                name: null
            }
        }
    }

    const result = getOpenChar(text);

    if(result === null) {
        return null;
    }
    
    const type = result.type;

    if(type === TextType.Array) {
        return getOpenChar(result.name);
    }

    return result;
}

export function getOpenChar(text: string): {type: TextType, name: string} | null {
    text = text.trimEnd();
    
    const openingChars = new Map<string, {reversed: string, result: TextType}>([
        ['(', {result: TextType.FunctionArgument, reversed: ')'}],
        ['[', {result: TextType.Array, reversed: ']'}],

    ]);
    const closingChars = new Map<string, {count: number}>([
        [')', {count: 0}],
        [']', {count: 0}]
    ]);
    const stringChars = new Set<string>([
        '"', "'", '`'
    ]);
    const singleChars = new Map<string, {result: TextType}>([
        ['=', {result: TextType.Variable}],
        [':', {result: TextType.Key}]
    ]);

    let currentOpeningChar: string | null = null;

    for (let i = text.length - 1; i >= 0; i--) {
        const char = text[i];

        if(currentOpeningChar !== null) {
            if(char === currentOpeningChar) {
                currentOpeningChar = null;
                continue;
            }
            continue;
        }

        if(stringChars.has(char)) {
            currentOpeningChar = char;
            continue;
        }

        if(singleChars.has(char)) {
            const result = singleChars.get(char)!;
            return {type: result.result, name: text.substring(0, i)};
        }

        if(openingChars.has(char)) {
            const result = openingChars.get(char)!;
            const reversedInfo =  closingChars.get(result.reversed)!;
            if(reversedInfo.count === 0) {
                return {type: result.result, name: text.substring(0, i)};
            }

            reversedInfo.count = reversedInfo.count - 1;
            continue;
        }

        if(closingChars.has(char)) {
            const result = closingChars.get(char)!;
            result.count = result.count + 1;
            continue;
        }
    }

    return null;
}


// export function getTextType(allParts: {value: string, shouldTranslate: boolean}[]): {type: TextType, name: string | null} | null {
//     const before = allParts[allParts.length - 1].value.trimEnd();

//     if(before.endsWith(':')) {
//         return {type: TextType.Key, name: getKey(before)};
//     }

//     if(before.endsWith('=')) {
//         return {type: TextType.Variable, name: before.slice(undefined, before.length - 1).trimEnd()}
//     }

//     if(before.endsWith('[')) {
//         return {type: TextType.Array, name: before.slice(undefined, before.length - 1).trimEnd()};
//     }

//     if(before.endsWith('(')) {
//         return {type: TextType.FunctionArgument, name: before.slice(undefined, before.length - 1).trimEnd()};
//     }

//     if(before.endsWith(',')) {
//         // can be array or function argument
//         let arrayCount = 0;
//         let functionCount = 0;

//         for(const {value, shouldTranslate} of allParts.reverse()) {
//             if(shouldTranslate) {
//                 continue;
//             }

//             for(let i = value.length - 1; i >= 0; i--) {
//                 const char = value[i];

//                 if(char === '[') {
//                     if(arrayCount === 0) {

//                         return {
//                             type: TextType.Array,
//                             name: value.slice(undefined, i)
//                         } 
//                     } else {
//                         arrayCount = arrayCount - 1;
//                         continue;
//                     }
//                 }

//                 if(char === '(') {
//                     if(functionCount === 0) {

//                         return {
//                             type: TextType.FunctionArgument,
//                             name: value.slice(undefined, i)
//                         }
//                     } else {
//                         functionCount = functionCount - 1;
//                         continue;
//                     }
//                 }

//                 if(char === ']') {
//                     arrayCount = arrayCount + 1;
//                     continue;
//                 }

//                 if(char === ')') {
//                     functionCount = functionCount + 1;
//                     continue;
//                 }
//             }
//         }
//     }

//     if(before.endsWith('+')) {
//         for(const part of allParts) {
//             if(part.shouldTranslate) {
//                 continue;
//             }
//         }
//     }

//     return null;
// }

// function getKey(text: string): string | null {
//     const matches = [...text.matchAll(/\w+/gm)];
//     if(matches.length === 0) {
//         return null;
//     }
//     const matchedText = matches.map(match => match[0]);

//     return matchedText[matchedText.length - 1];
// }
