<template lang="pug">
ensure-endpoint-initialized
  v-card
    v-card-title: h2 Search
    v-layout(column)
      v-flex(pl-2,pr-2): v-expansion-panel(expand,v-model="expandOptions")
        v-expansion-panel-content(key="1")
          div(slot="header") Basic options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12,sm6): v-text-field(label="Endpoint",v-model="$store.state.endpoint",disabled)
            v-flex(xs12,sm6): v-select(label="Default level",v-model="level",:items="levels")
            v-flex(xs12)
              v-textarea(label="Query",v-model="params.query")
              span.caption Understands an expanded form of <a href="http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#package.description">Lucene query parser syntax</a>. Fields usable in the query are:
              v-tooltip(bottom,v-for="fieldInfo in availableQueryableFields",:key="fieldInfo.field")
                v-chip(small,slot="activator") {{fieldInfo.field}}
                | {{fieldInfo.fieldInfo.description}}
            v-flex(xs12,lg8): v-autocomplete(close,label="Fields to return",v-model="params.field",multiple,chips,:items="availableFields",item-value="value.field")
              v-chip(slot="selection",color="primary",text-color="white",slot-scope="data",@input="data.parent.selectItem(data.item)",close) {{ data.item.value.field }}
            v-flex(xs6,lg2): v-checkbox(label="Show matches",v-model="params.returnMatches",true-value="true",false-value="false")
            v-flex(xs6,lg2): v-text-field(label="Limit",hint="-1 for no limit",type="number",v-model="params.limit")
        v-expansion-panel-content(key="2")
          div(slot="header") Advanced options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-textarea(label="Offset Data Converter Script")
            v-flex(xs12): v-text-field(label="Other parameters")
      v-flex: v-btn(color="primary",@click="search()") Search
  | &nbsp;
  v-card
    v-card-title
      h2(v-show="results.length != totalResults") First {{results.length}} out of {{ totalResults }} results
      h2(v-show="results.length == totalResults") All {{results.length}} results
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(:search="tsearch",:custom-filter="customFilter",v-bind:pagination.sync="pagination",ref="dtable",:items="results",:loading="loading",hide-actions,item-key="id",:headers="headers",expand,must-sort)
      template(slot="items" slot-scope="props"): tr(active="true",@click="props.expanded = !props.expanded")
        td {{ props.item.score }}
        td(v-for="field in params.field.filter(f => f !== 'content')")
          span(v-if="Array.isArray(props.item[field])")
            v-chip(small,v-for="value in props.item[field]",:key="value") {{value}}
          a(v-else-if="typeof(props.item[field]) == 'string' && props.item[field].indexOf('http')===0",:href="props.item[field]",target="_blank") {{ props.item[field] }}
          span(v-else) {{ props.item[field] }}
      template(slot="expand",slot-scope="props")
        v-card(tile,v-for="snippet in props.item.snippets",:key="snippet.start"): v-card-text(v-html="snippet.snippet")
        v-card(tile,v-if="props.item.content"): v-card-text {{props.item.content}}
      template(slot="no-data")
        v-alert(:value="error",color="error",icon="warning") {{error}}
  v-flex: v-card
    v-card-title: h2 Request
    a(:href="request",target="_blank") {{ request }}
</template>
<script lang="ts">
import lodash from 'lodash'
import axios from '@/common/MyAxios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import { AuthInfo } from '@/common/AuthInfo'
import EnsureEndpointInitialized from '@/components/EnsureEndpointInitialized.vue'
import { ILevelInfo, IFieldInfo, MyVue, IndexingType, StoreType } from '@/store'
import { AxiosResponse } from 'axios'
class Option<V> {
  constructor(public text: string, public value: V) {}
}
interface IMatch {
  start: number
  end: number
  terms: string[]
}
interface ISnippet {
  start: number
  matches: IMatch[]
  snippet: string
  end: number
}
interface ISearchResult {
  score: number
  id: number
  snippets?: ISnippet[]
  [fieldId: string]: number | string | ISnippet[] | undefined
}
interface ISearchResults {
  queryMetadata: {}
  results: {
    final_query: string
    docs: ISearchResult[]
    total: number
  }
}
@Component({
  localStorage: localStorageConfig,
  components: {
    EnsureEndpointInitialized
  }
})
export default class Search extends MyVue {
  private loading = false
  private error = ''
  private request = ''
  private tsearch = ''
  private customFilter(
    items: ISearchResult[],
    search: string,
    filter: (i: any, s: string) => boolean,
    headers: { text: string; value: string }[]
  ) {
    search = search.toString().toLowerCase()
    if (search.trim() === '') return items
    const props = headers.map(h => h.value)
    return items.filter(
      item =>
        (item.snippets &&
          item.snippets.some(snippet => filter(snippet.snippet, search))) ||
        props.some(prop => filter(item[prop], search))
    )
  }
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
    if (!lodash.isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/search',
        query: nq
      })
    axios
      .get(this.$store.state.endpoint + 'search', {
        params: this.params
      })
      .then((response: AxiosResponse<ISearchResults>) => {
        this.request =
          response.config.url +
          '?pretty&' +
          response.config.paramsSerializer!(response.config.params)
        this.loading = false
        this.totalResults = response.data.results.total
        this.results = response.data.results.docs
        this.results.forEach((r, idx) => {
          // hack until expanded works
          r.id = idx
          if (this.params.returnMatches === 'true')
            this.$set((this.$refs['dtable'] as any)['expanded'], r.id, true)
        })
      })
      .catch(error => {
        console.log(error)
        this.loading = false
        this.results = []
        this.error = error
      })
  }
  private level: ILevelInfo = {} as ILevelInfo
  private levels: Option<ILevelInfo>[] = []
  private availableFields: Option<{
    field: string
    fieldInfo: IFieldInfo
  }>[] = []
  private availableQueryableFields: {
    field: string
    fieldInfo: IFieldInfo
  }[] = []
  private params = {
    returnMatches: 'true',
    query: '',
    field: [],
    limit: 20
  }
  private get headers() {
    return [{ text: 'score', value: 'score' }].concat(
      this.params.field
        .filter(h => h !== 'content')
        .map(h => ({ text: h, value: h }))
    )
  }
  private pagination = {
    sortBy: 'score',
    descending: true,
    rowsPerPage: -1
  }
  private expandOptions = [true, false]
  private totalResults: number = 0
  private results: ISearchResult[] = []
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!lodash.isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (this.$store.state.endpoint && this.params.query) this.search()
    }
  }
  @Watch('level')
  private onLevelChanged(): void {
    this.availableFields = []
    this.availableQueryableFields = []
    for (let field in this.$store.state.indexInfo.commonFields) {
      let fieldInfo = this.$store.state.indexInfo.commonFields[field]
      let fd = {
        field,
        fieldInfo
      }
      if (fieldInfo.storedAs != StoreType.NONE)
        this.availableFields.push(
          new Option(field + ': ' + fieldInfo.description, fd)
        )
      if (fieldInfo.indexedAs != IndexingType.NONE)
        this.availableQueryableFields.push(fd)
    }
    for (let field in this.level.fields) {
      let fieldInfo = this.level.fields[field]
      let fd = {
        field,
        fieldInfo
      }
      if (fieldInfo.storedAs != StoreType.NONE)
        this.availableFields.push(
          new Option(field + ': ' + fieldInfo.description, fd)
        )
      if (fieldInfo.indexedAs != IndexingType.NONE)
        this.availableQueryableFields.push(fd)
    }
  }
  @Watch('$store.state.indexInfo', { immediate: true })
  private onIndexInfoChanged(): void {
    if (this.$store.state.indexInfo.levels) {
      this.levels = this.$store.state.indexInfo.levels.map(
        (l: ILevelInfo) => new Option(l.id + ': ' + l.description, l)
      )
      this.level = this.$store.state.indexInfo.levels[0]
      /*    this.level = this.$store.state.indexInfo.levels.find(
        (l: ILevelInfo) => l.id === this.$store.state.indexInfo.defaultLevel
      )!*/
      if (this.params.query) this.search()
    }
  }
}
</script>
