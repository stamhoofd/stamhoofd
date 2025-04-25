import readline from 'readline/promises';


export enum YesNoOrDoubt {
    Yes,
    No,
    Doubt
}

export async function promptYesNoOrDoubt(message: string): Promise<YesNoOrDoubt> {
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

function answerToResult(answer: string): YesNoOrDoubt {
    if(!answer) {
        return YesNoOrDoubt.Yes;
    }
    
    switch(answer.trim().toLowerCase()) {
        case 'y':
        case 'yes': {
            return YesNoOrDoubt.Yes;
        }
        case 'd': {
            return YesNoOrDoubt.Doubt;
        }
        default: return YesNoOrDoubt.No;
    }
}
