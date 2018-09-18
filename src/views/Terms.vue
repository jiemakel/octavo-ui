<template lang="pug">
ensure-endpoint-initialized
  v-card
    v-card-title: h2 Term Discovery
    v-layout(column): v-flex(pl-2,pr-2): v-container(fluid,pl-2,pr-2): v-layout(row wrap)
      v-flex(xs12,sm6): v-text-field(label="Endpoint",v-model="$store.state.endpoint",disabled)
      v-flex(xs12,sm6): v-select(label="Default level",v-model="params.level",:items="levels",item-value="value.id")
      v-flex(xs12,sm8)
        v-text-field(label="Query",v-model="params.query")
        | Understands an expanded form of <a href="http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#package.description">Lucene query parser syntax</a>.
      v-flex(xs12,sm4): v-text-field(label="Limit",hint="-1 for no limit",type="number",v-model="params.limit")
    v-btn(color="primary",@click="search()") Search
  | &nbsp;
  v-card
    v-card-title
      h2(v-show="results.length != totalTerms") First {{results.length}} out of {{ totalTerms }} results (total document frequency: {{totalDocFreq}}, total term frequency: {{totalTermFreq}})
      h2(v-show="results.length == totalTerms") All {{results.length}} results (total document frequency: {{totalDocFreq}}, total term frequency: {{totalTermFreq}})
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(:search="tsearch",v-bind:pagination.sync="pagination",v-model="selected",:items="results",hide-actions,select-all,must-sort,:loading="loading",item-key="term",:headers="headers")
      template(slot="items" slot-scope="props"): tr
        td: v-checkbox(v-model="props.selected",primary,hide-details)
        td: router-link(:to="{ name: 'search', query: Object.assign({},$route.query,{query: props.item.term }) }", target="_blank") {{ props.item.term }}
        td {{ props.item.docFreq }}
        td {{ props.item.totalTermFreq }}
      template(slot="no-data")
        v-alert(:value="error",color="error",icon="warning") {{error}}
  | &nbsp;
  v-card
    v-card-title
      h2 Generated query
    v-container(fluid): v-layout(column)
      v-text-field(label="Separator",v-model="separator")
      v-textarea(label="Query",v-model="generatedQuery")
      v-btn(color="secondary",:to="{ name: 'search', query: Object.assign({},$route.query,{query: generatedQuery }) }", target="_blank") Search
  | &nbsp;
  v-card
    v-card-title: h2 Request
    v-container(fluid): a(:href="request",target="_blank") {{ request }}
</template>
<script lang="ts">
import { isEqual } from 'lodash'
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
  private loading = false
  private error = ''
  private request = ''
  private tsearch = ''
  private auths = this.$localStorage.get('auths')
  private search() {
    this.loading = true
    let nq = Object.assign(
      {},
      this.$route.query,
      {
        endpoint: this.$store.state.endpoint
      },
      this.params
    )
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        name: 'terms',
        query: nq
      })
    axios
      .get(this.$store.state.endpoint + 'similarTerms', {
        params: this.params,
        auth: this.auths[this.$store.state.endpoint]
      })
      .then((response: AxiosResponse<ISimilarTermsResults>) => {
        this.request =
          response.config.url +
          '?pretty&' +
          response.config.paramsSerializer!(response.config.params)
        this.loading = false
        this.totalTerms = response.data.results.general.terms
        this.totalTermFreq = response.data.results.general.totalTermFreq
        this.totalDocFreq = response.data.results.general.totalDocFreq
        this.results = response.data.results.results
      })
      .catch(error => {
        this.loading = false
        this.results = []
        this.error = error
      })
  }
  private params = {
    limit: 20,
    level: '',
    query: ''
  }
  private pagination = {
    sortBy: 'docFreq',
    descending: true,
    rowsPerPage: -1
  }
  private generatedQuery = ''
  private levels: Option<ILevelInfo>[] = []
  private headers = [
    { text: 'term', value: 'term' },
    { text: 'docFreq', value: 'docFreq' },
    { text: 'totalTermFreq', value: 'totalTermFreq' }
  ]
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (this.$store.state.endpoint && this.params.query) this.search()
    }
  }
  @Watch('$store.state.indexInfo', { immediate: true })
  private onIndexInfoChanged(): void {
    if (this.$store.state.indexInfo.levels) {
      this.levels = this.$store.state.indexInfo.levels.map(
        (l: ILevelInfo) => new Option(l.id + ': ' + l.description, l)
      )
      this.params.level = this.$store.state.indexInfo.levels.find(
        (l: ILevelInfo) => l.id === this.$store.state.indexInfo.defaultLevel
      )!.id
      if (this.params.query) this.search()
    }
  }
}
</script>
