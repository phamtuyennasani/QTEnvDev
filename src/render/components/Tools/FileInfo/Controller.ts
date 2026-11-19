import { reactiveBind } from '@/util/Index'
import { fs } from '@/util/NodeFn'
import { FileInfoModel } from './FileInfoModel'

export const fileInfoController = reactiveBind(new FileInfoModel({
  stat: (path) => fs.stat(path),
  hash: (path, algorithm) => fs.getFileHash(path, algorithm)
}))
