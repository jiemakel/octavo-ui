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
            v-flex(xs6,lg2): v-text-field(label="Maximum number of documents to return",hint="-1 for no limit",type="number",v-model="params.limit")
            v-flex(xs6,lg2): v-text-field(label="Maximum number of snippets to return per document",hint="-1 for no limit",v-model="params.snippetLimit",type="number")
        v-expansion-panel-content(key="2")
          div(slot="header") Advanced options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-textarea(label="Field Enrichment Script",v-model="params.fieldEnricher")
            v-flex(xs12): v-textarea(label="Offset Data Converter Script",v-model="params.offsetDataConverter")
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
          v-tooltip(top)
            div(v-if="props.item.tooltips[field]",v-html="props.item.tooltips[field]")
            div(slot="activator")
              span(v-if="Array.isArray(props.item[field])")
                v-chip(small,v-for="value in props.item[field]",:key="value") {{value}}
              a(v-else-if="typeof(props.item[field]) == 'string' && props.item[field].indexOf('http')===0",:href="props.item[field]",target="_blank") {{ props.item[field] }}
              span(v-else) {{ props.item[field] }}
      template(slot="expand",slot-scope="props")
        v-tooltip(top,v-for="snippet in props.item.snippets",:key="snippet.start")
          v-card(slot="activator",tile): v-card-text(v-html="snippet.snippet")
          img(:src="snippet.imgurl")
        v-card(tile,v-if="props.item.content"): v-card-text {{props.item.content}}
      template(slot="no-data")
        v-alert(:value="error",color="error",icon="warning") {{error}}
  | &nbsp;
  v-card
    v-card-title: h2 Request
    v-container(fluid): a(:href="request",target="_blank") {{ request }}
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
  imgurl: string
}
interface ISearchResult {
  score: number
  id: number
  snippets?: ISnippet[]
  tooltips: {
    [fieldId: string]: string
  }
  links: {
    [fieldId: string]: string
  }
  [fieldId: string]: any
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
  private auths = this.$localStorage.get('auths')
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
  private get fieldEnricher(): (
    field: string,
    value: any,
    obj: ISearchResult
  ) => {
    link?: string
    tooltip?: string
  } {
    return new Function('field', 'value', 'obj', this.params.fieldEnricher) as (
      field: string,
      value: any,
      obj: ISearchResult
    ) => {
      link?: string
      tooltip?: string
    }
  }
  private get offsetDataConverter(): (
    snippet: ISnippet,
    doc: ISearchResult
  ) => string {
    return new Function('snippet', 'doc', this.params.offsetDataConverter) as (
      snippet: ISnippet,
      doc: ISearchResult
    ) => string
  }
  private search() {
    this.loading = true
    const nq = Object.assign(
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
    let cp = this.params
    if (this.params.offsetDataConverter)
      cp = Object.assign({ offsetData: 'true' }, cp)
    axios
      .get(this.$store.state.endpoint + 'search', {
        params: cp,
        auth: this.auths[this.$store.state.endpoint]
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
          r.id = idx
          r.tooltips = {}
          r.links = {}
          for (let field of this.params.field) {
            let res = this.fieldEnricher(field, r[field], r)
            if (res) {
              if (res.link) r.links[field] = res.link
              if (res.tooltip) r.tooltips[field] = res.tooltip
            }
          }
          if (r.snippets)
            for (let snippet of r.snippets)
              try {
                snippet.imgurl = this.offsetDataConverter(snippet, r)
              } catch (error) {
                console.log(error)
              }
          // hack until expanded works
          if (this.params.snippetLimit !== 0)
            this.$set((this.$refs['dtable'] as any)['expanded'], r.id, true)
        })
      })
      .catch(error => {
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
    fieldEnricher: '',
    offsetDataConverter: '',
    query: '',
    field: [],
    limit: 20,
    snippetLimit: 20
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
      if (!Array.isArray(this.params.field))
        this.params.field = [this.params.field]
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
      if (this.params.query) this.search()
    }
  }
}
</script>
