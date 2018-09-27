<template lang="pug">
ensure-endpoint-initialized
  v-card
    v-card-title: h2 Keyword in Context Search
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
            v-flex(xs6,sm3): v-text-field(label="Max matches to return",hint="-1 for no limit",type="number",v-model="params.limit")
            v-flex(xs6,sm3): v-select(label="Amount of context to return",v-model="params.contextLevel",:items="['Character','Token','Word','Line','Sentence','Paragraph']")
            v-flex(xs6,sm3): v-text-field(label="Extend context left",type="number",v-model="params.contextExpandLeft")
            v-flex(xs6,sm3): v-text-field(label="Extend context right",type="number",v-model="params.contextExpandRight")
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
  v-card
    v-card-title
      h2(v-show="results.length != totalResults") First {{results.length}} out of {{ totalResults }} results
      h2(v-show="results.length == totalResults") All {{results.length}} results
      v-spacer
      v-text-field(v-model="tsearch",append-icon="search",label="Filter",single-line,hide-details)
    v-data-table(ref="dtable",:items="results",:loading="loading",item-key="id",:total-items="totalResults",hide-headers,expand)
      template(slot="items" slot-scope=" "): tr(active="true",@click="props.expanded = !props.expanded")
        td: div(style="width:100%;overflow:auto").text-xs-right {{ props.item.context.substring(0,props.item.match.start) }}
        td: div(style="width:100%;overflow:auto") {{ props.item.context.substring(props.item.match.start,props.item.match.end) }}
        td: div(style="width:100%;overflow:auto").text-xs-left {{ props.item.context.substring(props.item.match.end) }}
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
  id: number
  start: number
  matches: IMatch[]
  snippet: string
  end: number
  imgurl: string
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
    matches: ISnippet[]
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
export default class KWIC extends MyVue {
  private loading = false
  private error = ''
  private request = ''
  private tsearch = ''
  private auths = this.$localStorage.get('auths')
  private totalResults: number = 0
  private results: ISnippet[] = []
  private filteredResults: ISnippet[] = []
  @Watch('tsearch')
  @Watch('results')
  private customFilter() {
    const search = this.tsearch.toLowerCase().trim()
    if (search === '') this.filteredResults = this.results
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
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/kwic',
        query: nq
      })
    let cp = this.params
    if (this.params.offsetDataConverter)
      cp = Object.assign({ offsetData: 'true' }, cp)
    axios
      .get(this.$store.state.endpoint + 'kwic', {
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
        this.results = response.data.results.matches
        this.results.forEach((r, idx) => {
          r.id = idx
          r.tooltips = {}
          r.links = {}
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
    contextLevel: 'Sentence',
    contextExpandLeft: 0,
    contextExpandRight: 0,
    sortContextLevel: 'Word',
    sortContextDistance: [] as string[],
    sortContextDirection: [] as string[]
  }
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
