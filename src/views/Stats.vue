<template lang="pug">
div
  v-card
    v-card-title: h2 Statistics
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
            v-flex(xs6,sm3): v-text-field(label="Max documents to sample",hint="-1 for no limit",v-model="params.maxDocs",type="number")
        v-expansion-panel-content(key="3")
          div(slot="header") Advanced options
          v-container(fluid): v-layout(row,wrap)
            v-flex(xs12): v-text-field(label="Other parameters",v-model="otherParameters")
      v-flex: v-btn(color="primary",@click="search()") Query
  | &nbsp;
  v-alert(:value="errorMessage",color="error",icon="warning")
    h2 An error occurred:
    pre {{errorMessage}}
  v-card(:show="!error")
    v-card-title
      h2(v-show="sampledResults!= totalResults") Statistics based on a sample of {{sampledResults | numFormat}} out of a total {{totalResults | numFormat}} results
      h2(v-show="sampledResults == totalResults") Statistics based on all {{ totalResults | numFormat }} results
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

interface IGroup {
  fields: { [field: string]: any }
  stats: {
    totalTermFreq: number
    docFreq: number
  }
}
interface IStatsResults {
  queryMetadata: {}
  result: {
    general: {
      totalTermFreq: number
      docFreq: number
      totalDocs: number
    }
    grouped: IGroup[]
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
export default class Stats extends AbstractView {
  private totalResults = 0
  private sampledResults = 0
  protected params = {
    endpoint: '',
    query: '',
    field: [],
    offset: 0,
    limit: 20,
    maxDocs: 50000,
    level: '',
    sortDirection: undefined
  }
  private pagination = {
    sortBy: undefined,
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
    if (this.pagination.sortBy)
      Object.assign(this.params, {
        sort: this.pagination.sortBy,
        sortDirection: this.pagination.descending ? 'D' : 'A'
      })
    else this.params.sortDirection = undefined
    const nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        path: '/stats',
        query: nq
      })
    let cp = Object.assign({}, this.params)
    try {
      const response: AxiosResponse<IStatsResults> = await axios.get(
        this.params.endpoint + 'queryStats?' + this.otherParameters,
        {
          params: cp,
          auth: this.auths[this.params.endpoint]
        }
      )
      this.request =
        response.config.url + '?pretty&' + response.config.paramsSerializer!(response.config.params)
      this.totalResults = response.data.result.general.totalDocs
      this.sampledResults = response.data.result.general.docFreq
      this.results = response.data.result.grouped
      const isNumeric = this.params.field.map(f => {
        const g = this.results.find(g => g.fields[f] != null)
        return g ? typeof g.fields[f] == 'number' : false
      })
      const numerics = isNumeric.reduce((c, v) => (v ? c + 1 : c + 0), 0)
      const categorical = this.params.field.length-numerics
      if (numerics == 2 && categorical==0) { // single scatterplot
      } else if (numerics == 2 && categorical==1) { // single faceted scatterplot
      } else if (numerics == 2 && categorical==2) { // double faceted scatterplot
      } else if (numerics == 1 && categorical==0) { // singular line graph
      } else if (numerics == 1 && categorical==1) { // multiple line graph
      } else if (numerics == 1 && categorical==2) { // single faceted multiple line graph
      } else if (numerics == 1 && categorical==3) { // double faceted multiple line graph
      } else if (numerics == 0 && categorical==1) { // bar chart
      } else if (categorical==0) { // parallel coordinates
      } else if (numerics == 0) { // sankey diagram
      } else {
        this.results = []
        this.error = 'Don\'t know how to chart with '+numerics+' numerical and '+categorical+' categorical attributes'
      }
      console.log(numerics,categorical)
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
  private results: IGroup[] = []
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) {
      Object.assign(this.params, this.$route.query)
      if (!Array.isArray(this.params.field)) this.params.field = [this.params.field]
      if (this.params.endpoint && this.params.query) this.search()
    }
  }
  @Watch('params.level')
  @Watch('indexInfo')
  private onLevelChanged(): void {
    this.availableFields = []
    this.availableQueryableFields = []
    const fieldsSeen: { [id: string]: boolean } = {}
    if (store.indexInfos[this.params.endpoint]) {
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
