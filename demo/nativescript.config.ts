import { NativeScriptConfig } from '@nativescript/core'

export default {
  id: 'org.nativescript.plugindemo.calendar',
  main: 'app.ts',
  appResourcesPath: 'app/App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
    suppressCallJSMethodExceptions: false,
  },
  appPath: 'app',
} as NativeScriptConfig
