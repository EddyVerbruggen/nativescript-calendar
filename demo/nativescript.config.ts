import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.nativescript.plugindemo.calendar',
  main: 'app.ts',
  appResourcesPath: 'app/App_Resources',
  android: {
    v8Flags: '--nolazy --expose_gc',
    markingMode: "none",
    suppressCallJSMethodExceptions: false
  }
} as NativeScriptConfig;