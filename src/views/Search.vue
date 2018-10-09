<template lang="pug">
ensure-endpoint-initialized
  v-card
    v-card-title: h2 Search
    v-layout(column)
      v-flex(pl-2,pr-2): v-expansion-panel(expand,v-model="expandOptions")
        v-expansion-panel-content(key="1")
          div(slot="header") Query options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12,sm6): v-text-field(label="Endpoint",v-model="$store.state.endpoint",disabled)
            v-flex(xs12,sm6): v-select(label="Default level",v-model="level",:items="levels")
            v-flex(xs12)
              v-textarea(label="Query",v-model="params.query")
              span.caption Understands an expanded form of <a href="http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#package.description">Lucene query parser syntax</a>. Fields usable in the query are:
              v-tooltip(bottom,v-for="fieldInfo in availableQueryableFields",:key="fieldInfo.field")
                v-chip(small,slot="activator") {{fieldInfo.field}}
                | {{fieldInfo.fieldInfo.description}}
        v-expansion-panel-content(key="2")
          div(slot="header") Return options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-autocomplete(close,label="Fields to return",v-model="params.field",multiple,chips,:items="availableFields",item-value="value.field")
              v-chip(slot="selection",color="primary",text-color="white",slot-scope="data",@input="data.parent.selectItem(data.item)",close) {{ data.item.value.field }}
            v-flex(xs6,sm3): v-text-field(label="Max snippets per doc",hint="-1 for no limit",v-model="params.snippetLimit",type="number")
            v-flex(xs6,sm3): v-select(label="Amount of context to return",v-model="params.contextLevel",:items="['Character','Token','Word','Line','Sentence','Paragraph']")
            v-flex(xs6,sm3): v-text-field(label="Extend context left",type="number",v-model="params.contextExpandLeft")
            v-flex(xs6,sm3): v-text-field(label="Extend context right",type="number",v-model="params.contextExpandRight")
        v-expansion-panel-content(key="3")
          div(slot="header") Advanced options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-textarea(label="Field Enrichment Script",v-model="params.fieldEnricher")
            v-flex(xs12): v-textarea(label="Offset Data Converter Script",v-model="params.offsetDataConverter")
            v-flex(xs12): v-text-field(label="Other parameters",v-model="otherParameters")
      v-flex: v-btn(color="primary",@click="search()") Search
  | &nbsp;
  v-card
    v-card-title
      h2(v-show="results.length != totalResults && params.offset == 0") First {{results.length}} out of {{ totalResults }} results
      h2(v-show="results.length != totalResults && params.offset != 0") Results {{params.offset}}-{{params.offset+results.length}} out of {{ totalResults }} results
      h2(v-show="results.length == totalResults") All {{results.length}} results
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(:pagination.sync="pagination",ref="dtable",:items="filteredResults",:loading="loading",:total-items="totalResults",:rows-per-page-items="[10,20,50,100,200,{'text':'$vuetify.dataIterator.rowsPerPageAll','value':-1}]",item-key="id",:headers="headers",expand,must-sort)
      template(slot="items" slot-scope="props"): tr(active="true",@click="props.expanded = !props.expanded")
        td {{ props.item.score }}
        td(v-for="field in params.field.filter(f => f !== 'content')")
          component(:is="props.item.tooltips[field] ? 'v-tooltip' : 'div'",lazy,top)
            div(v-if="props.item.tooltips[field]",v-html="props.item.tooltips[field]")
            div(slot="activator")
              span(v-if="Array.isArray(props.item[field])")
                v-chip(small,v-for="value in props.item[field]",:key="value") {{value}}
              a(v-else-if="typeof(props.item[field]) == 'string' && props.item[field].indexOf('http')===0",:href="props.item[field]",target="_blank") {{ props.item[field] }}
              a(v-else-if="props.item.links[field]",:href="props.item.links[field]",target="_blank") {{ props.item[field] }}
              span(v-else) {{ props.item[field] }}
      template(slot="expand",slot-scope="props")
        component(:is="snippet.tooltip ? 'v-tooltip' : 'div'",lazy,top,v-for="snippet in props.item.snippets",:key="snippet.start")
          v-card(:href="snippet.link",target=" _blank",slot="activator",tile): v-card-text(v-html="snippet.snippet")
          div(v-if="snippet.tooltip",v-html="snippet.tooltip")
        v-card(tile,v-if="props.item.content"): v-card-text {{props.item.content}}
      template(slot="no-results")
        v-alert(:value="error",color="error",icon="warning"): pre {{error}}
  | &nbsp;
  v-card
    v-card-title: h2 Request
    v-container(fluid): a(:href="request",target="_blank") {{ request }}
</template>
<script lang="ts">
import { isEqual } from 'lodash-es'
import axios from '@/common/MyAxios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import { AuthInfo } from '@/common/AuthInfo'
import EnsureEndpointInitialized from '@/components/EnsureEndpointInitialized.vue'
import { ILevelInfo, IFieldInfo, MyVue, IndexingType, StoreType } from '@/store'
import { AxiosResponse } from 'axios'
import * as VCard from 'vuetify/es5/components/VCard'
import * as VTextField from 'vuetify/es5/components/VTextField'
import * as VTextarea from 'vuetify/es5/components/VTextarea'
import * as VBtn from 'vuetify/es5/components/VBtn'
import * as VSelect from 'vuetify/es5/components/VSelect'
import * as VDataTable from 'vuetify/es5/components/VDataTable'
import * as VAlert from 'vuetify/es5/components/VAlert'
import * as VCheckbox from 'vuetify/es5/components/VCheckbox'
import * as VChip from 'vuetify/es5/components/VChip'
import * as VTooltip from 'vuetify/es5/components/VTooltip'
import * as VExpansionPanel from 'vuetify/es5/components/VExpansionPanel'
import * as VAutocomplete from 'vuetify/es5/components/VAutocomplete'

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
  link?: string
  tooltip?: string
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
    EnsureEndpointInitialized,
    ...VCard,
    ...VChip,
    ...VTooltip,
    ...VDataTable,
    ...VAlert,
    ...VBtn,
    ...VTextField,
    ...VTextarea,
    ...VSelect,
    ...VAutocomplete,
    ...VExpansionPanel
  }
})
export default class Search extends MyVue {
  private loading = false
  private error = ''
  private request = ''
  private tsearch = ''
  private auths = this.$localStorage.get('auths')
  private filteredResults: ISearchResult[] = []
  @Watch('tsearch')
  @Watch('results')
  private customFilter() {
    const search = this.tsearch.toLowerCase().trim()
    if (search === '') this.filteredResults = this.results
    const props = this.headers.map(h => h.value)
    this.filteredResults = this.results.filter(
      item =>
        (item.snippets &&
          item.snippets.some(
            snippet => snippet.snippet.toLowerCase().indexOf(search) !== -1
          )) ||
        props.some(
          prop => ('' + item[prop]).toLowerCase().indexOf(search) !== -1
        )
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
  ) => string[] {
    return new Function('snippet', 'doc', this.params.offsetDataConverter) as (
      snippet: ISnippet,
      doc: ISearchResult
    ) => string[]
  }
  private totalResults = 0
  private params = {
    fieldEnricher: '',
    offsetDataConverter: '',
    query: '',
    field: [],
    offset: 0,
    limit: 20,
    snippetLimit: 20,
    contextLevel: 'Sentence',
    contextExpandLeft: 0,
    contextExpandRight: 0,
    level: null
  }
  private pagination = {
    sortBy: 'score',
    descending: true,
    page: 1,
    rowsPerPage: this.params.limit
  }
  private otherParameters = ''
  @Watch('pagination', { deep: true })
  private search() {
    this.loading = true
    this.params.offset =
      (this.pagination.page - 1) * this.pagination.rowsPerPage
    this.params.limit = this.pagination.rowsPerPage
    const nq = Object.assign(
      {},
      this.$route.query,
      {
        endpoint: this.$store.state.endpoint
      },
      this.params
    )
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/search',
        query: nq
      })
    let cp = Object.assign({}, this.params, {
      query:
        this.params.query.indexOf('<') !== 0
          ? '<' +
            this.level.id +
            '§' +
            this.params.query +
            '§' +
            this.level.id +
            '>'
          : this.params.query
    })
    if (this.params.offsetDataConverter)
      Object.assign(cp, { offsetData: 'true' })
    if (
      this.pagination.sortBy != 'score' ||
      this.pagination.descending == false
    )
      Object.assign(cp, {
        sort: this.pagination.sortBy,
        sortDirection: this.pagination.descending ? 'D' : 'A'
      })
    axios
      .get(this.$store.state.endpoint + 'search?' + this.otherParameters, {
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
                ;[snippet.tooltip, snippet.link] = this.offsetDataConverter(
                  snippet,
                  r
                )
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
        console.log(error)
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
  private get headers() {
    return [{ text: 'score', value: 'score' }].concat(
      this.params.field
        .filter(h => h !== 'content')
        .map(h => ({ text: h, value: h }))
    )
  }
  private expandOptions = [true, true, false]
  private results: ISearchResult[] = []
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
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
      const fl = this.$store.state.indexInfo.levels.find(
        l => l.id == this.params.level
      )
      this.level = fl ? fl : this.$store.state.indexInfo.levels[0]
      if (this.params.query) this.search()
    }
  }
}
</script>
