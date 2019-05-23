<template lang="pug">
div
  v-card
    v-card-title: h2 Term Discovery
    v-layout(column): v-flex(pl-2,pr-2): v-container(fluid,pl-2,pr-2): v-layout(row wrap)
      v-flex(xs12,sm6): v-select(label="Endpoint",v-model="params.endpoint",:items="endpoints")
      v-flex(xs12,sm6): v-select(label="Default level",v-model="params.level",:items="levels",item-value="value.id")
      v-flex(xs12)
        v-text-field(label="Query",v-model="params.query")
        | Understands an expanded form of <a href="http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#package.description">Lucene query parser syntax</a>.
    v-btn(color="primary",@click="search()") Search
  | &nbsp;
  v-alert(:value="errorMessage",color="error",icon="warning")
    h2 An error occurred:
    pre {{errorMessage}}
  v-card(v-show="!error")
    v-card-title
      h2(v-show="results.length != totalTerms") First {{results.length | numFormat}} out of {{ totalTerms | numFormat }} results (total document frequency: {{totalDocFreq | numFormat}}, total term frequency: {{totalTermFreq | numFormat}})
      h2(v-show="results.length == totalTerms") All {{results.length | numFormat}} results (total document frequency: {{totalDocFreq | numFormat}}, total term frequency: {{totalTermFreq | numFormat}})
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(:pagination.sync="pagination",ref="dtable",v-model="selected",:items="filteredResults",:loading="loading",:total-items="totalTerms",:rows-per-page-items="[10,20,50,100,200,{'text':'$vuetify.dataIterator.rowsPerPageAll','value':-1}]",item-key="term",:headers="headers",must-sort,select-all)
      template(slot="items" slot-scope="props"): tr
        td: v-checkbox(v-model="props.selected",primary,hide-details)
        td: router-link(:to="{ name: 'search', query: Object.assign({},$route.query,{query: props.item.term }) }", target="_blank") {{ props.item.term }}
        td {{ props.item.totalDocFreq | numFormat }}
        td {{ props.item.totalTermFreq | numFormat }}
  | &nbsp;
  v-card(v-show="totalTerms>0")
    v-card-title
      h2 Generated query
    v-container(fluid): v-layout(column)
      v-text-field(label="Separator",v-model="separator")
      v-textarea(label="Query",v-model="generatedQuery")
      v-btn(color="secondary",:to="{ name: 'search', query: Object.assign({},$route.query,{query: generatedQuery }) }", target="_blank") Search
  | &nbsp;
  v-card(v-show="!error")
    v-card-title: h2 Request
    v-container(fluid): a(:href="request",target="_blank") {{ request }}
</template>
<script lang="ts">
import { isEqual } from 'lodash-es'
import axios from '@/common/MyAxios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import store, { ILevelInfo, IFieldInfo, IndexingType, StoreType } from '@/store'
import { AxiosResponse } from 'axios'
import * as VCard from 'vuetify/es5/components/VCard'
import * as VTextField from 'vuetify/es5/components/VTextField'
import * as VTextarea from 'vuetify/es5/components/VTextarea'
import * as VBtn from 'vuetify/es5/components/VBtn'
import * as VSelect from 'vuetify/es5/components/VSelect'
import * as VDataTable from 'vuetify/es5/components/VDataTable'
import * as VAlert from 'vuetify/es5/components/VAlert'
import * as VCheckbox from 'vuetify/es5/components/VCheckbox'
import { AbstractView } from '@/views/AbstractView'
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
  result: {
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
    ...VCard,
    ...VBtn,
    ...VTextField,
    ...VTextarea,
    ...VSelect,
    ...VDataTable,
    ...VAlert,
    ...VCheckbox
  }
})
export default class Terms extends AbstractView {
  protected params = {
    sort: 'TDF',
    sortDirection: 'D',
    offset: 0,
    limit: 20,
    level: '',
    query: '',
    endpoint: ''
  }
  private totalTerms: number = 0
  private totalTermFreq: number = 0
  private totalDocFreq: number = 0
  private results: ITermInfo[] = []
  private headers = [
    { text: 'term', value: 'term' },
    { text: 'total document frequency', value: 'TDF' },
    { text: 'total term frequency', value: 'TTF' }
  ]
  private pagination = {
    sortBy: 'TDF',
    descending: true,
    page: 1,
    rowsPerPage: this.params.limit
  }
  private tsearch = ''
  private get filteredResults() {
    const search = this.tsearch.toLowerCase().trim()
    if (search === '') return this.results
    const props = this.headers.map(h => h.value)
    return this.results.filter(item => item.term.toLowerCase().indexOf(search) !== -1)
  }
  private selected: ITermInfo[] = []
  private separator: string = 'OR'
  private generatedQuery = ''
  @Watch('selected')
  @Watch('separator')
  private onSelect() {
    this.generatedQuery = this.selected.map(s => s.term).join(' ' + this.separator + ' ')
  }
  @Watch('pagination', { deep: true })
  private async search() {
    this.loading = true
    this.error = null
    this.params.sort = this.pagination.sortBy
    this.params.offset = (this.pagination.page - 1) * this.pagination.rowsPerPage
    this.params.limit = this.pagination.rowsPerPage
    this.params.sortDirection = this.pagination.descending ? 'D' : 'A'
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        name: 'terms',
        query: nq
      })
    try {
      const response = await axios.get(this.params.endpoint + 'similarTerms', {
        params: this.params,
        auth: this.auths[this.params.endpoint]
      })
      this.request =
        response.config.url + '?pretty&' + response.config.paramsSerializer!(response.config.params)
      this.loading = false
      this.totalTerms = response.data.result.general.terms
      this.totalTermFreq = response.data.result.general.totalTermFreq
      this.totalDocFreq = response.data.result.general.totalDocFreq
      this.results = response.data.result.results
    } catch (error) {
      this.loading = false
      this.error = error
    }
  }
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (this.params.endpoint && this.params.query) this.search()
    }
  }
  @Watch('indexInfo')
  private onIndexInfoChanged(): void {
    if (this.indexInfo) {
      this.params.level = this.indexInfo.levels.find(
        (l: ILevelInfo) => l.id === this.indexInfo!.defaultLevel
      )!.id
      if (this.params.query) this.search()
    }
  }
}
</script>
