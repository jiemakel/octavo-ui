declare module 'vue-localstorage'
interface VueLocalStorage {
  namespace: string
  get(lsKey: string, defaultValue?: any, defaultType?: Function): any
  set<T>(lsKey: string, value: T): T
  addProperty(key: string, type: Function, defaultValue?: any): void
}
