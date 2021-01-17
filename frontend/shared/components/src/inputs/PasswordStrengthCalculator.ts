import zxcvbn from '@zxcvbn-ts/core'
import zxcvbnCommonPackage from '@zxcvbn-ts/language-common'

const options = {
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    //...zxcvbnEnPackage.dictionary,
  },
  //translations: zxcvbnEnPackage.translations,
}

export function checkPassword(password: string) {
    return zxcvbn(password, options)
}