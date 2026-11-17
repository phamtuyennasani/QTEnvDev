import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'
const config: Config = {
  darkMode: 'selector',
  content: ['./src/render/**/*.{js,ts,tsx,vue,md,html}', './web/**/*.{js,ts,vue,md,html}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        'surface-hover': 'var(--color-surface-hover)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-ink-muted)',
        rule: 'var(--color-rule)',
        accent: 'var(--color-accent)',
        'accent-soft': 'var(--color-accent-soft)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)'
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)']
      },
      spacing: {
        control: 'var(--size-control)',
        sidebar: 'var(--size-sidebar)',
        page: 'var(--space-md)'
      }
    }
  },
  plugins: [typography]
}
export default config
