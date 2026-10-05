import readline from 'readline/promises';

export enum YesNoOrDoubt {
    Yes,
    No,
    Doubt,
}

export async function promptYesNoOrDoubt(message: string): Promise<YesNoOrDoubt> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.on('SIGINT', () => {
        console.clear();
        process.exit();
    });

    try {
        const answer = await rl.question(message + ' ');
        return answerToResult(answer);
    }
    finally {
        rl.close();
        rl.removeAllListeners();
    }
}

function answerToResult(answer: string): YesNoOrDoubt {
    if (!answer) {
        return YesNoOrDoubt.Yes;
    }

    switch (answer.trim().toLowerCase()) {
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
