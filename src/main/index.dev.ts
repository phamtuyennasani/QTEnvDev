import debugFn from 'electron-debug'
import App from './index'

debugFn({
  // Keep the app usable during development. DevTools can still be opened
  // explicitly through the application's developer command.
  showDevTools: false
})

App()

export {}
