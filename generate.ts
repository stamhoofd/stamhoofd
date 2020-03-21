import { member, record } from './src/structs/Member';
import path from 'path';
import { Struct } from './src/classes/struct-builder/Struct';

Struct.save([record, member], path.join(__dirname, 'src/generated/structs.ts'));