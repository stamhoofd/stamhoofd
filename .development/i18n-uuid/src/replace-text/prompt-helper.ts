import readline from 'readline/promises';


export enum ReplaceTextPromptResult {
    Yes,
    No,
    Doubt
}

export async function promptReplaceText(message: string): Promise<ReplaceTextPromptResult> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

    rl.on("SIGINT", () => {
        console.clear();
        process.exit()
    });
    
    rl.question(message + ' ');

    let listener = () => {};

    const answer: string = await new Promise(resolve => {
        listener = () => resolve(rl.line);
        (rl as any)['input'].on("keypress", listener);
    });

    (rl as any)['input'].removeListener("keypress", listener);

    rl.close();
    rl.removeAllListeners();
    
    return answerToResult(answer);
}

function answerToResult(answer: string): ReplaceTextPromptResult {
    if(!answer) {
        return ReplaceTextPromptResult.Yes;
    }
    
    switch(answer.trim().toLowerCase()) {
        case 'y':
        case 'yes': {
            return ReplaceTextPromptResult.Yes;
        }
        case 'd': {
            return ReplaceTextPromptResult.Doubt;
        }
        default: return ReplaceTextPromptResult.No;
    }
}
