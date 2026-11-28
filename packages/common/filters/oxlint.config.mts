import { createOxlintConfig } from 'oxlint-plugin-stamhoofd';
import eslint from './eslint.config.js';

export default await createOxlintConfig(eslint);
