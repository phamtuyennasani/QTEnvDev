interface RegExpGroupIndices {
  [name: string]: [number, number]
}
interface RegExpIndices extends Array<[number, number]> {
  groups: RegExpGroupIndices
}
interface RegExpExecArrayWithIndices extends RegExpExecArray {
  indices: RegExpIndices
}
interface GroupCapture {
  name: string
  value: string
  start: number
  end: number
}

export function matchRegex(regex: string, text: string, flags: string) {
  const re = new RegExp(regex, flags)
  const results = []
  let match = re.exec(text) as RegExpExecArrayWithIndices
  while (match !== null) {
    const indices = match.indices
    const captures: Array<GroupCapture> = []
    Object.entries(match).forEach(([captureName, captureValue]) => {
      if (captureName !== '0' && captureName.match(/\d+/)) {
        const range = indices[Number(captureName)]
        if (!range) return
        captures.push({
          name: captureName,
          value: captureValue,
          start: range[0],
          end: range[1]
        })
      }
    })
    const groups: Array<GroupCapture> = []
    Object.entries(match.groups || {}).forEach(([groupName, groupValue]) => {
      const range = indices.groups[groupName]
      if (!range) return
      groups.push({
        name: groupName,
        value: groupValue,
        start: range[0],
        end: range[1]
      })
    })
    results.push({
      index: match.index,
      value: match[0],
      captures,
      groups
    })
    if (!re.global || results.length >= 10000) break
    if (match[0] === '') {
      const codePoint = text.codePointAt(re.lastIndex)
      re.lastIndex += (re.unicode || re.unicodeSets) && codePoint !== undefined && codePoint > 0xffff ? 2 : 1
    }
    match = re.exec(text) as RegExpExecArrayWithIndices
  }
  return results
}
