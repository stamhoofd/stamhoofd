// All characters except difficult to differentiate characters in uppercase (0, O, 1, L, I).
const codeAllowList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '2', '3', '4', '5', '6', '7', '8', '9'];

function randomChars(num = 4) {
    let result = '';
    for (let i = 0; i < num; i++) {
        result += codeAllowList[Math.floor(Math.random() * codeAllowList.length)];
    }
    return result;
}

export function generateDiscountCode() {
    return randomChars(4) + '-' + randomChars(4) + '-' + randomChars(4) + '-' + randomChars(4);
}
