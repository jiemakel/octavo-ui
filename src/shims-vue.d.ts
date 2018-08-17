import { State } from './store'
import { Store } from 'vuex'
import Vue from 'vue'

declare module '*.vue' {
  export default Vue
}

interface ILocalStorage {
  namespace: string
  get(lsKey: string, defaultValue?: any, defaultType?: Function): any
  set<T>(lsKey: string, value: T): T
  addProperty(key: string, type: Function, defaultValue?: any): void
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    localStorage?: { [id: string]: string | { type: Function; default: any } }
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $localStorage: ILocalStorage
  }
}
