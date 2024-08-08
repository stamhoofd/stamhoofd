
export class DataValidator {
    static readonly UITPAS_NUMBER_REGEX = /^\d{1,13}$/;

    static isEmailValid(str: string) {
        const blockList = ["gmail.be", "gmail.nl", "hotmail.c", "hotmail.co", "gmail.co", "gmail.c", "gmail.co", "gmal.com", "glail.com", "gmail.col", "gamil.com", "gmail.con", "icloud.be"]
        const regex = /^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        
        if (!regex.test(str)) {
            return false
        }

        for (const l of blockList) {
            if (str.endsWith("@"+l)) {
                return false
            }
        }

        return true
    }

    static isUitpasNumberValid(str: string) {
        return this.UITPAS_NUMBER_REGEX.test(str);
    }
}
