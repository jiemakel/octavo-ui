<template lang="pug">
div
  v-card
    v-card-title: h2 Search
    v-layout(column)
      v-flex(pl-2,pr-2): v-expansion-panel(expand,v-model="expandOptions")
        v-expansion-panel-content(key="1")
          div(slot="header") Query options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12,sm6): v-select(label="Endpoint",v-model="params.endpoint",:items="endpoints")
            v-flex(xs12,sm6): v-select(label="Default level",v-model="params.level",:items="levels",item-value="value.id")
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
            v-flex(xs6,sm3): v-select(label="Amount of context to return",v-model="params.contextLevel",:items="['Character','Token','Word','Line','Sentence','Paragraph','Document']")
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
  v-alert(:value="errorMessage",color="error",icon="warning")
    h2 An error occurred:
    pre {{errorMessage}}
  v-card(:show="!error")
    v-card-title
      h2(v-show="results.length != totalResults && params.offset == 0") First {{results.length}} out of {{ totalResults }} results
      h2(v-show="results.length != totalResults && params.offset != 0") Results {{params.offset}}-{{params.offset+results.length}} out of {{ totalResults }} results
      h2(v-show="results.length == totalResults") All {{results.length}} results
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(:pagination.sync="pagination",v-model="selected",ref="dtable",:items="filteredResults",:loading="loading",:total-items="totalResults",:rows-per-page-items="[10,20,50,100,200,{'text':'$vuetify.dataIterator.rowsPerPageAll','value':-1}]",item-key="idx",:headers="headers",expand,must-sort,select-all)
      template(slot="items" slot-scope="props"): tr(active="true",@click="props.expanded = !props.expanded")
        td: v-checkbox(v-model="props.selected",primary,hide-details)
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
    v-card-title
      h2 Generated query
    v-container(fluid): v-layout(column)
      v-textarea(label="Query",v-model="generatedQuery")
      v-btn(color="secondary",:to="{ name: 'search', query: Object.assign({},params.query,{query: generatedQuery }) }", target="_blank") Search
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
import store, { ILevelInfo, IFieldInfo, IndexingType, StoreType } from '@/store'
import { AxiosResponse } from 'axios'
import { AbstractView } from '@/views/AbstractView'
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
  result: {
    final_query: string
    docs: ISearchResult[]
    total: number
  }
}
@Component({
  localStorage: localStorageConfig,
  components: {
    ...VCard,
    ...VChip,
    ...VCheckbox,
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
export default class Search extends AbstractView {
  private tsearch = ''
  private selected: ISearchResult[] = []
  private get filteredResults() {
    const search = this.tsearch.toLowerCase().trim()
    if (search === '') return this.results
    const props = this.headers.map(h => h.value)
    return this.results.filter(
      item =>
        (item.snippets &&
          item.snippets.some(snippet => snippet.snippet.toLowerCase().indexOf(search) !== -1)) ||
        props.some(prop => ('' + item[prop]).toLowerCase().indexOf(search) !== -1)
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
  private get offsetDataConverter(): (snippet: ISnippet, doc: ISearchResult) => string[] {
    return new Function('snippet', 'doc', this.params.offsetDataConverter) as (
      snippet: ISnippet,
      doc: ISearchResult
    ) => string[]
  }
  private totalResults = 0
  protected params = {
    endpoint: '',
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
    level: ''
  }
  private pagination = {
    sortBy: 'score',
    descending: true,
    page: 1,
    rowsPerPage: this.params.limit
  }
  private otherParameters = ''
  private generatedQuery = ''
  @Watch('pagination', { deep: true })
  private async search() {
    this.error = null
    this.loading = true
    this.params.offset = (this.pagination.page - 1) * this.pagination.rowsPerPage
    this.params.limit = this.pagination.rowsPerPage
    Object.assign(this.params, {
      sort: this.pagination.sortBy,
      sortDirection: this.pagination.descending ? 'D' : 'A'
    })
    const nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/search',
        query: nq
      })
    let cp = Object.assign({}, this.params)
    if (this.params.offsetDataConverter) Object.assign(cp, { offsetData: 'true' })
    try {
      const response: AxiosResponse<ISearchResults> = await axios.get(
        this.params.endpoint + 'search?' + this.otherParameters,
        {
          params: cp,
          auth: this.auths[this.params.endpoint]
        }
      )
      this.request =
        response.config.url + '?pretty&' + response.config.paramsSerializer!(response.config.params)

      this.totalResults = response.data.result.total
      this.results = response.data.result.docs
      this.results.forEach((r, idx) => {
        r.idx = idx
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
          for (const snippet of r.snippets) {
            snippet.snippet = snippet.snippet.replace(/\n/g, '<br>\n')
            try {
              ;[snippet.tooltip, snippet.link] = this.offsetDataConverter(snippet, r)
            } catch (error) {
              console.log(error)
            }
          }
        // hack until expanded works
        if (this.params.snippetLimit !== 0)
          this.$set((this.$refs['dtable'] as any)['expanded'], r.idx, true)
      })
    } catch (error) {
      this.results = []
      this.error = error
    } finally {
      this.loading = false
    }
  }
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
      this.params.field.filter(h => h !== 'content').map(h => ({ text: h, value: h }))
    )
  }
  private expandOptions = [true, true, false]
  private results: ISearchResult[] = []
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (!Array.isArray(this.params.field)) this.params.field = [this.params.field]
      if (this.params.endpoint && this.params.query) this.search()
    }
  }
  @Watch('selected')
  @Watch('separator')
  private onSelect() {
    this.generatedQuery = this.selected
      .map(s => this.currentLevel!.idField + ':' + s[this.currentLevel!.idField])
      .join(' OR ')
  }
  private currentLevel?: ILevelInfo = undefined
  @Watch('params.level')
  @Watch('indexInfo')
  private onLevelChanged(): void {
    this.availableFields = []
    this.availableQueryableFields = []
    const fieldsSeen: { [id: string]: boolean } = {}
    if (this.indexInfo) {
      for (let field in this.indexInfo!.commonFields) {
        let fieldInfo = this.indexInfo!.commonFields[field]
        let fd = {
          field,
          fieldInfo
        }
        if (fieldInfo.storedAs != StoreType.NONE)
          this.availableFields.push(new Option(field + ': ' + fieldInfo.description, fd))
        if (fieldInfo.indexedAs != IndexingType.NONE) this.availableQueryableFields.push(fd)
        fieldsSeen[field] = true
      }
      this.currentLevel = this.indexInfo!.levels.find(
        (l: ILevelInfo) => l.id === this.params.level
      )!
      for (let field in this.currentLevel.fields)
        if (!fieldsSeen[field]) {
          let fieldInfo = this.currentLevel.fields[field]
          let fd = {
            field,
            fieldInfo
          }
          if (fieldInfo.storedAs != StoreType.NONE)
            this.availableFields.push(new Option(field + ': ' + fieldInfo.description, fd))
          if (fieldInfo.indexedAs != IndexingType.NONE) this.availableQueryableFields.push(fd)
          fieldsSeen[field] = true
        }
      this.params.field = this.params.field.filter(field => fieldsSeen[field])
    }
  }
}
</script>
