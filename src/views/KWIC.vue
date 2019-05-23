<template lang="pug">
div
  v-card
    v-card-title: h2 Keyword in Context Search
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
            v-flex(xs4): v-select(label="Amount of context to return",v-model="params.contextLevel",:items="['Character','Token','Word','Line','Sentence','Paragraph']")
            v-flex(xs4): v-text-field(label="Extend context left",type="number",v-model="params.contextExpandLeft")
            v-flex(xs4): v-text-field(label="Extend context right",type="number",v-model="params.contextExpandRight")
            v-flex(xs6): v-select(label="Context sort level",v-model="params.sortContextLevel",:items="['Character','Token','Word','Line','Sentence','Paragraph']")
            v-flex(xs6): v-text-field(label="Sort distance indices",v-model="sortIndices",:rules="sortRules",hint="Separate distance indices by commas. Add D to specify descending sort. E.g. \"0D,-1D,1\"")
            v-flex(xs12,lg8): v-autocomplete(close,label="Fields to return",v-model="params.field",multiple,chips,:items="availableFields",item-value="value.field")
              v-chip(slot="selection",color="primary",text-color="white",slot-scope="data",@input="data.parent.selectItem(data.item)",close) {{ data.item.value.field }}

        v-expansion-panel-content(key="3")
          div(slot="header") Advanced options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-textarea(label="Field Enrichment Script",v-model="params.fieldEnricher")
            v-flex(xs12): v-textarea(label="Offset Data Converter Script",v-model="params.offsetDataConverter")
            v-flex(xs12): v-text-field(label="Other parameters")
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
    v-data-table(:pagination.sync="pagination",:rows-per-page-items="[10,20,50,100,200,{'text':'$vuetify.dataIterator.rowsPerPageAll','value':-1}]",ref="dtable",:items="filteredResults",:loading="loading",item-key="id",:total-items="totalResults",hide-headers,expand)
      template(slot="items" slot-scope="props"): tr(active="true",@click="props.expanded = !props.expanded")
        td(style="white-space:nowrap",v-html="props.item.left").text-xs-right
        td {{ props.item.snippet.substring(props.item.match.start,props.item.match.end) }}
        td(style="white-space:nowrap",v-html="props.item.right").text-xs-left
      template(slot="expand",slot-scope="props")
        table: tr
          td(v-for="(value,field) in props.item.fields",:key="field"): v-tooltip(top)
            span(slot="activator",v-html="value")
            img(:src="props.item.imgurl")
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
  text: string
  start: number
  end: number
  terms: string[]
}
interface ISnippet {
  id: number
  start: number
  match: IMatch
  snippet: string
  end: number
  tooltip: string
  link: string
  left: string
  right: string
  sort: [
    {
      start: number
      end: number
      text: string
    }
  ]
  tooltips: {
    [fieldId: string]: string
  }
  links: {
    [fieldId: string]: string
  }
  fields: {
    imgurl: string
    [fieldId: string]: any
  }
}
interface ISearchResults {
  queryMetadata: {}
  result: {
    final_query: string
    matches: ISnippet[]
    total: number
  }
}
@Component({
  localStorage: localStorageConfig,
  components: {
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
export default class KWIC extends AbstractView {
  private tsearch = ''
  private totalResults: number = 0
  private results: ISnippet[] = []
  private filteredResults: ISnippet[] = []
  @Watch('tsearch')
  @Watch('results')
  private customFilter() {
    const search = this.tsearch.toLowerCase().trim()
    if (search === '') this.filteredResults = this.results
    this.filteredResults = this.results.filter(
      item => item.snippet.toLowerCase().indexOf(search) !== -1
    )
  }
  private get fieldEnricher(): (
    field: string,
    value: any,
    obj: ISnippet
  ) => {
    link?: string
    tooltip?: string
  } {
    return new Function('field', 'value', 'obj', this.params.fieldEnricher) as (
      field: string,
      value: any,
      obj: ISnippet
    ) => {
      link?: string
      tooltip?: string
    }
  }
  private get offsetDataConverter(): (snippet: ISnippet) => string {
    return new Function('snippet', this.params.offsetDataConverter) as (snippet: ISnippet) => string
  }
  protected params = {
    level: '',
    endpoint: '',
    fieldEnricher: '',
    offsetDataConverter: '',
    query: '',
    field: [],
    limit: 20,
    offset: 0,
    contextLevel: 'Sentence',
    contextExpandLeft: 0,
    contextExpandRight: 0,
    sortContextLevel: 'Word',
    sortContextDistance: [] as string[],
    sortContextDirection: [] as string[]
  }
  private pagination = {
    page: 1,
    rowsPerPage: this.params.limit
  }
  @Watch('pagination', { deep: true })
  private async search() {
    this.loading = true
    this.params.offset = (this.pagination.page - 1) * this.pagination.rowsPerPage
    this.params.limit = this.pagination.rowsPerPage
    const nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/kwic',
        query: nq
      })
    let cp = this.params
    if (this.params.offsetDataConverter) cp = Object.assign({ offsetData: 'true' }, cp)
    try {
      const response: AxiosResponse<ISearchResults> = await axios.get(
        this.params.endpoint + 'kwic',
        {
          params: cp,
          auth: this.auths[this.params.endpoint]
        }
      )
      this.request =
        response.config.url + '?pretty&' + response.config.paramsSerializer!(response.config.params)
      this.totalResults = response.data.result.total
      this.results = response.data.result.matches
      this.results.forEach((r, idx) => {
        r.match.start = r.match.start - r.start
        r.match.end = r.match.end - r.start
        r.sort.forEach(s => {
          s.start = s.start - r.start
          s.end = s.end - r.start
        })
        r.left = r.snippet.substring(0, r.match.start)
        r.right = r.snippet.substring(r.match.end)
        r.sort
          .sort((a, b) => a.start - b.start)
          .forEach((s, i) => {
            if (s.start < r.match.start)
              r.left =
                r.left.substring(0, s.start) +
                '<span class="' +
                this.styles[i % this.styles.length] +
                '">' +
                r.left.substring(s.start, s.end) +
                '</span>' +
                r.left.substring(s.end)
            else if (s.start > r.match.end)
              r.right =
                r.right.substring(0, s.start - r.match.end) +
                '<span class="' +
                this.styles[i % this.styles.length] +
                '">' +
                r.right.substring(s.start - r.match.end, s.end - r.match.end) +
                '</span>' +
                r.right.substring(s.end - r.match.end)
          })
        r.id = idx
        try {
          ;[r.tooltip, r.link] = this.offsetDataConverter(r)
        } catch (error) {
          console.log(error)
        }
        for (let field of this.params.field) {
          try {
            let res = this.fieldEnricher(field, r.fields[field], r)
            if (res) {
              if (res.link) r.links[field] = res.link
              if (res.tooltip) r.tooltips[field] = res.tooltip
            }
          } catch (error) {
            console.log(error)
          }
        }
      })
    } catch (error) {
      this.results = []
      this.error = error
    } finally {
      this.loading = false
    }
  }
  private level: ILevelInfo = {} as ILevelInfo
  private styles = [
    'red--text',
    'pink--text',
    'purple--text',
    'indigo--text',
    'blue--text',
    'cyan--text',
    'teal--text',
    'light-green--text',
    'lime--text',
    'amber--text',
    'orange--text',
    'brown--text',
    'blue-grey--text'
  ]
  private availableFields: Option<{
    field: string
    fieldInfo: IFieldInfo
  }>[] = []
  private availableQueryableFields: {
    field: string
    fieldInfo: IFieldInfo
  }[] = []
  private sortIndices = '0,-1,1'
  @Watch('sortIndices', { immediate: true })
  private onSortIndicesChanges(): void {
    let re = /(-?\d+)([ADad]?)/g
    let m: RegExpExecArray | null
    this.params.sortContextDistance = []
    this.params.sortContextDirection = []
    while ((m = re.exec(this.sortIndices))) {
      this.params.sortContextDistance.push(m[1])
      this.params.sortContextDirection.push(m[2] !== '' ? m[2] : 'A')
    }
  }
  private sortRules = [
    (v: string) =>
      /^(?:-?\d+[ADad]?\s*,?\s*)*$/.test(v) ||
      'Separate indices by commas. Add D to specify descending sort. E.g. "0D,-1D,1"'
  ]
  private expandOptions = [true, true, false]
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (!Array.isArray(this.params.field)) this.params.field = [this.params.field]
      if (this.params.endpoint && this.params.query) this.search()
    }
  }
  @Watch('level')
  @Watch('indexInfo')
  private onLevelChanged(): void {
    this.availableFields = []
    this.availableQueryableFields = []
    const fieldsSeen: { [id: string]: boolean } = {}
    if (this.indexInfo) {
      for (let field in store.indexInfos[this.params.endpoint]!.commonFields) {
        let fieldInfo = store.indexInfos[this.params.endpoint]!.commonFields[field]
        let fd = {
          field,
          fieldInfo
        }
        if (fieldInfo.storedAs != StoreType.NONE)
          this.availableFields.push(new Option(field + ': ' + fieldInfo.description, fd))
        if (fieldInfo.indexedAs != IndexingType.NONE) this.availableQueryableFields.push(fd)
        fieldsSeen[field] = true
      }
      let level = this.indexInfo!.levels.find((l: ILevelInfo) => l.id === this.params.level)!
      for (let field in level.fields)
        if (!fieldsSeen[field]) {
          let fieldInfo = level.fields[field]
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
