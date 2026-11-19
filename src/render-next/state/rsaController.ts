import { reactiveBind } from '@/util/Index'
import { nodeForge } from '@/util/NodeFn'
import { RsaOperation } from '../tools/RsaOperation'
export const rsaController = reactiveBind(new RsaOperation((input) => nodeForge.rsaGenerateKeyPair(input)))
