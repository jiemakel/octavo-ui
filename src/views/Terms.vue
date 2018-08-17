<template lang="pug">
ensure-endpoint-initialized
  h2 Term Discovery
  v-form: v-container: v-layout(row wrap)
    v-flex(xs12,md6): v-text-field(label="Endpoint",v-model="$store.state.endpoint",disabled)
    v-flex(xs12,md6): v-select(label="Default level",v-model="level",:items="levels")
    v-flex(xs12,md6)
      v-text-field(label="Query",v-model="query")
      | Understands an expanded form of <a href="http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#package.description">Lucene query parser syntax</a>.
    v-flex(xs12,md6): v-text-field(label="Limit",hint="-1 for no limit",type="number",v-model="limit")
    v-flex(xs12): v-btn(color="primary",@click="search()") Search
  v-data-table(v-bind:pagination.sync="pagination",v-model="selected",:items="results",hide-actions,select-all,must-sort,item-key="term",:headers="headers")
    template(slot="items" slot-scope="props"): tr
      td: v-checkbox(v-model="props.selected",primary,hide-details)
      td: router-link(:to="{ name: 'search', query: Object.assign({},$route.query,{query: props.item.term }) }", target="_blank") {{ props.item.term }}
      td {{ props.item.docFreq }}
      td {{ props.item.totalTermFreq }}
  v-form: v-container: v-layout(column)
    v-text-field(label="Separator",v-model="separator")
    v-textarea(label="Query",v-model="generatedQuery")
    v-btn(color="secondary",:to="{ name: 'search', query: Object.assign({},$route.query,{query: generatedQuery }) }", target="_blank") Search
</template>
<script lang="ts">
import axios from '@/common/MyAxios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import { AuthInfo } from '@/common/AuthInfo'
import EnsureEndpointInitialized from '@/components/EnsureEndpointInitialized.vue'
import { ILevelInfo, IFieldInfo } from '@/store'
import { AxiosResponse } from 'axios'
class Option<V> {
  constructor(public text: string, public value: V) {}
}
interface ITermInfo {
  term: string
  docFreq: number
  totalTermFreq: number
}
interface ISimilarTermsResults {
  queryMetadata: {}
  results: {
    general: {
      terms: number
      totalDocFreq: number
      totalTermFreq: number
    }
    results: ITermInfo[]
  }
}
@Component({
  localStorage: localStorageConfig,
  components: {
    EnsureEndpointInitialized
  }
})
export default class Terms extends Vue {
  private totalTerms: number = -1
  private totalTermFreq: number = -1
  private totalDocFreq: number = -1
  private results: ITermInfo[] = []
  private selected: ITermInfo[] = []
  private separator: string = 'OR'
  @Watch('selected')
  @Watch('separator')
  private onSelect() {
    this.generatedQuery = this.selected
      .map(s => s.term)
      .join(' ' + this.separator + ' ')
  }
  private search() {
    this.results = []
    this.$router.push({
      path: '/terms',
      query: Object.assign({}, this.$route.query, {
        endpoint: this.$store.state.endpoint,
        query: this.query,
        level: this.level.id,
        limit: this.limit
      })
    })
    axios
      .get(this.$store.state.endpoint + 'similarTerms', {
        params: {
          query: this.query,
          level: this.level.id,
          limit: this.limit
        }
      })
      .then((response: AxiosResponse<ISimilarTermsResults>) => {
        this.totalTerms = response.data.results.general.terms
        this.totalTermFreq = response.data.results.general.totalTermFreq
        this.totalDocFreq = response.data.results.general.totalDocFreq
        this.results = response.data.results.results
      })
  }
  @Prop() private initialQuery!: string
  private query = this.initialQuery
  private pagination = {
    sortBy: 'docFreq',
    descending: true,
    rowsPerPage: -1
  }
  private generatedQuery = ''
  private level: ILevelInfo = {} as ILevelInfo
  private levels: Option<ILevelInfo>[] = []
  private headers = [
    { text: 'term', value: 'term' },
    { text: 'docFreq', value: 'docFreq' },
    { text: 'totalTermFreq', value: 'totalTermFreq' }
  ]
  private limit: number = 20
  @Watch('$store.state.indexInfo', { immediate: true })
  private onIndexInfoChanged(): void {
    if (this.$store.state.indexInfo.levels) {
      this.levels = this.$store.state.indexInfo.levels.map(
        (l: ILevelInfo) => new Option(l.id + ': ' + l.description, l)
      )
      this.level = this.$store.state.indexInfo.levels.find(
        (l: ILevelInfo) => l.id === this.$store.state.indexInfo.defaultLevel
      )!
      if (this.query) this.search()
    }
  }
}
</script>
