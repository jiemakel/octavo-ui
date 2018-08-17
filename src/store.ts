import Vue from 'vue'
import Vuex, { Store } from 'vuex'
import { AuthInfo } from '@/common/AuthInfo'

Vue.use(Vuex)

export enum IndexingType {
  TEXT = 'TEXT',
  STRING = 'STRING',
  INTPOINT = 'INTPOINT',
  LONGPOINT = 'LONGPOINT',
  FLOATPOINT = 'FLOATPOINT',
  DOUBLEPOINT = 'DOUBLEPOINT',
  NONE = 'NONE'
}

export enum StoreType {
  NUMERICDOCVALUES = 'NUMERICDOCVALUES',
  FLOATDOCVALUES = 'FLOATDOCVALUES',
  DOUBLEDOCVALUES = 'DOUBLEDOCVALUES',
  SORTEDDOCVALUES = 'SORTEDDOCVALUES',
  SORTEDNUMERICDOCVALUES = 'SORTEDNUMERICDOCVALUES',
  SORTEDSETDOCVALUES = 'SORTEDSETDOCVALUES',
  SINGULARSTOREDFIELD = 'SINGULARSTOREDFIELD',
  MULTIPLESTOREDFIELDS = 'MULTIPLESTOREDFIELDS',
  TERMVECTOR = 'TERMVECTOR',
  NONE = 'NONE'
}

export interface IFieldInfo {
  description: string
  indexedAs: IndexingType
  storedAs: StoreType
  distinctValues?: number
  containsJson: boolean
}

export interface ILevelInfo {
  id: string
  idField: string
  description: string
  fields: { [fieldId: string]: IFieldInfo }
}

export interface IIndexInfo {
  name: string
  version: string
  levels: ILevelInfo[]
  defaultLevel: string
  commonFields: { [fieldId: string]: IFieldInfo }
  contentField: string
  contentTokensField: string
  indexingAnalyzers: { [fieldId: string]: string }
}

export class State {
  public endpoint: string = ''
  public auth: AuthInfo | null = null
  public indexInfo: IIndexInfo = {} as IIndexInfo
}

export function setIndexInfo(store: Store<State>, indexInfo: State) {
  store.commit('setIndexInfo', indexInfo)
}

export default new Store({
  state: new State(),
  mutations: {
    setIndexInfo(
      state,
      payload: {
        endpoint: string
        auth: AuthInfo | null
        indexInfo: IIndexInfo
      }
    ) {
      state.endpoint = payload.endpoint
      state.auth = payload.auth
      state.indexInfo = payload.indexInfo
    }
  },
  actions: {}
})

export abstract class MyVue extends Vue {
  public $store!: Store<State>
}
