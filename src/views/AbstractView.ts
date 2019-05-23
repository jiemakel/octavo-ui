import { AxiosResponse, AxiosError } from 'axios'
import store, { ILevelInfo, IFieldInfo, IndexingType, StoreType } from '@/store'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
export class Option<V> {
  constructor(public text: string, public value: V) {}
}
export abstract class AbstractView extends Vue {
  protected loading = false
  protected error: AxiosError | string | null = null
  protected get errorMessage() {
    if (!this.error) return undefined
    else if (typeof this.error == 'string') return this.error
    let ret = this.error.message ? this.error.message + ': ' : ''
    if (this.error.response) ret += this.error.response.data
    else ret += 'Unknown error'
    return ret
  }
  protected request = ''
  protected store = store
  protected auths = this.$localStorage.get('auths')
  protected params = {
    endpoint: ''
  }
  protected get endpoints() {
    const endpointsO: { [id: string]: string } = this.$localStorage.get('endpoints')
    const ret: { text: string; value: string }[] = []
    for (let endpoint in endpointsO) ret.push({ text: endpointsO[endpoint], value: endpoint })
    return ret
  }
  @Watch('params.endpoint')
  private async onEndpointChanged() {
    this.loading = true
    try {
      await this.store.loadIndexInfo(this.params.endpoint)
    } catch (error) {
      this.error = error
    } finally {
      this.loading = false
    }
  }
  get indexInfo() {
    return this.store.indexInfos[this.params.endpoint]
  }
  get levels() {
    if (store.indexInfos[this.params.endpoint] && store.indexInfos[this.params.endpoint]!.levels)
      return store.indexInfos[this.params.endpoint]!.levels.map(
        (l: ILevelInfo) => new Option(l.id + ': ' + l.description, l)
      )
    return []
  }
}
