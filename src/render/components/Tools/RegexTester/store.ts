import { reactive } from 'vue'
import { matchRegex } from '@/components/Tools/RegexTester/regex-tester.service'
import RandExp from 'randexp'

const store = reactive({
  regex: '',
  text: '',
  global: true,
  ignoreCase: false,
  multiline: false,
  dotAll: true,
  unicode: true,
  unicodeSets: false,
  visualizerSVG: undefined,
  regexError: undefined,
  results: [],
  resultsLimited: false,
  sample: '',
  regexValidation() {
    try {
      new RegExp(this.regex)
      this.regexError = undefined
    } catch (e) {
      this.regexError = `${e}` as any
    }
  },
  computedResult() {
    let flags = 'd'
    if (this.global) {
      flags += 'g'
    }
    if (this.ignoreCase) {
      flags += 'i'
    }
    if (this.multiline) {
      flags += 'm'
    }
    if (this.dotAll) {
      flags += 's'
    }
    if (this.unicode) {
      flags += 'u'
    } else if (this.unicodeSets) {
      flags += 'v'
    }
    this.results = reactive([])
    this.resultsLimited = false
    try {
      this.results = reactive(matchRegex(this.regex, this.text, flags)) as any
      this.resultsLimited = this.results.length >= 10000
    } catch (_) {}
  },
  computedSample() {
    this.sample = ''
    try {
      const randexp = new RandExp(new RegExp(this.regex.replace(/\(\?\<[^\>]*\>/g, '(?:')))
      this.sample = randexp.gen()
    } catch (_) {}
  }
})

export default store
