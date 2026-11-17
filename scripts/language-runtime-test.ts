// Run: yarn tsx scripts/language-runtime-test.ts
import assert from 'node:assert/strict'
import { computed } from 'vue'
import { AppI18n, applyLanguagePayload, I18nT, releaseLocalePayload } from '../src/lang/runtime'

const i18n = AppI18n()
const locale = computed(() => i18n.global.locale.value)
const fallbackMessages = { greeting: 'Hello {name}', fallback: 'English fallback' }
assert.equal(i18n.mode, 'composition')
applyLanguagePayload({
  locale: 'vi',
  fallbackLocale: 'en',
  messages: { greeting: 'Xin chào {name}' },
  fallbackMessages
})
assert.equal(locale.value, 'vi')
assert.equal(I18nT('greeting', { name: 'QTEnvDev' }), 'Xin chào QTEnvDev')
assert.equal(I18nT('fallback'), 'English fallback')
applyLanguagePayload({
  locale: 'en',
  fallbackLocale: 'en',
  messages: fallbackMessages,
  fallbackMessages
})
assert.equal(locale.value, 'en')
assert.equal(I18nT('greeting', { name: 'QTEnvDev' }), 'Hello QTEnvDev')
assert.deepEqual(i18n.global.getLocaleMessage('vi'), {})
releaseLocalePayload('en')
assert.equal(I18nT('fallback'), 'English fallback')
console.log('Language runtime: translation, fallback, reactive locale and payload release passed')
