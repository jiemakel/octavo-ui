<template lang="pug">
div
  v-card
    v-card-title: h2 Overview
    v-layout(column): v-flex(pl-2,pr-2): v-container(fluid,pl-2,pr-2): v-layout(row,wrap)
      v-flex(xs12,sm6): v-select(label="Endpoint",v-model="params.endpoint",:items="endpoints")
      v-flex(xs12,sm6): v-select(label="Level",v-model="params.level",:items="levels",item-value="value.id")
      v-flex(xs6,sm3): v-text-field(label="Maximum terms to directly show frequencies for",type="number",v-model="params.maxTermsToStat")
    v-flex: v-btn(color="primary",@click="search()") Update
  | &nbsp;
  v-alert(:value="errorMessage",color="error",icon="warning")
    h2 An error occurred:
    pre {{errorMessage}}
  v-card(v-show="!error")
    v-card-title: h2 Field overview
    v-container(grid-list-sm fluid): v-layout(row,wrap): v-flex(xs12,sm4,xl3,v-for="fc in fields",:key="fc.fieldName"): v-card
      v-card-title
        h4
          router-link(:to="{ name: 'search', query: Object.assign({},$route.query,{query: fc.fieldName+':*',field: Array.isArray($route.query.field) ? $route.query.field.concat([fc.fieldName]) : ($route.query.field ? [$route.query.field, fc.fieldName] : [fc.fieldName]) }) }", target="_blank") {{fc.fieldName}}
          | :&nbsp;
        span {{fc.fi.description}}
      v-card-text: v-layout(row,wrap)
        v-flex(xs12,v-if="fc.fi.totalDocs") Present for: {{fc.fi.totalDocs | numFormat}} out of {{totalDocs | numFormat}} documents ({{+(fc.fi.totalDocs / totalDocs*100).toFixed(2)}}%)
        v-flex(xs12,v-if="fc.fi.totalTerms") Distinct tokens: {{fc.fi.totalTerms | numFormat}}
        v-flex(xs12,v-if="fc.fi.sumTotalTermFreq") Mean tokens per document: {{+(fc.fi.sumTotalTermFreq / fc.fi.totalDocs).toFixed(2)}}
        v-flex(xs12,v-if="fc.fi.min!==undefined") Min: {{fc.fi.min | numFormat}}, Max: {{fc.fi.max | numFormat}}
        v-flex(xs12,v-if="fc.c1data.length>0")
          v-tabs(v-if="fc.c2data.length>0")
            v-tab(key="1") Quantiles
            v-tab(key="2") Histogram
            v-tab-item(key="1"): MyGChart(:type="fc.c1type",:options="fc.c1options",:data="fc.c1data",:events="fc.c1events")
            v-tab-item(key="2"): MyGChart(:type="fc.c2type",:options="fc.c2options",:data="fc.c2data")
          MyGChart(v-if="fc.c2data.length==0",:type="fc.c1type",:options="fc.c1options",:data="fc.c1data",:events="fc.c1events")
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
import * as VTabs from 'vuetify/es5/components/VTabs'
import { AbstractView } from '@/views/AbstractView'
import MyGChart from '@/components/MyGChart.vue'
class Option<V> {
  constructor(public text: string, public value: V) {}
}

class FieldData {
  public fi: IFieldInfo
  public fieldName: string = ''
  public c1type: string = 'BarChart'
  public c1data: any[][] = []
  public c1options: any = {
    title: '',
    height: 300,
    hAxis: {
      scaleType: 'linear'
    },
    vAxis: {
      scaleType: 'linear'
    },
    legend: {
      position: 'none'
    }
  }
  public c1events: any = {
    select: (e: any) => {
      if (this.fi.termFreqs && e.getSelection()[0])
        this.scb(this.fieldName, this.c1data[e.getSelection()[0].row + 1][0])
    }
  }
  public c2type: string = ''
  public c2data: any[][] = []
  public c2options: any = {
    title: '',
    height: 300,
    hAxis: {
      scaleType: 'linear'
    },
    vAxis: {
      scaleType: 'linear'
    },
    legend: {
      position: 'none'
    }
  }
  private scb: (fieldName: string, value: string) => void
  constructor(fieldName: string, fi: IFieldInfo, scb: (fieldName: string, value: string) => void) {
    this.scb = scb
    this.fi = fi
    this.fieldName = fieldName
    if (fi.termFreqs) {
      this.c1options.title = 'Values'
      this.c1options.hAxis.scaleType = 'log'
      this.c1data.push(['Term', 'Document frequency', 'Term frequency'])
      for (let tf of fi.termFreqs) this.c1data.push([tf.term, tf.docFreq, tf.totalTermFreq])
    } else {
      if (fi.histogram) {
        this.c2type = 'ColumnChart'
        this.c2options.title = 'Histogram'
        this.c2data.push(['Range', 'Proportion'])
        this.c2options.vAxis.scaleType = 'log'
        for (let h of fi.histogram) this.c2data.push([h.min + ' - ' + h.max, h.proportion * 100])
      }
      if (fi.quantiles) {
        this.c1options.title = 'Quantiles'
        this.c1type = 'ColumnChart'
        this.c1data.push(['Quantile', fieldName + '<=', { role: 'tooltip' }])
        this.c1options.vAxis.scaleType = 'log'
        this.c1options.hAxis.minValue = 0
        this.c1options.hAxis.maxValue = 100
        this.c1options.hAxis.format = "#'%'"
        for (let q of fi.quantiles)
          this.c1data.push([
            parseFloat(q.quantile) * 100,
            q.max,
            +(parseFloat(q.quantile) * 100).toFixed(2) +
              '% of documents have ' +
              fieldName +
              '<=' +
              q.max
          ])
      } else if (fi.docFreqQuantiles) {
        this.c1options.title = 'Term frequency quantiles'
        this.c1type = 'ColumnChart'
        this.c1data.push([
          'Quontile',
          'Document Frequency',
          { role: 'tooltip' },
          'Term Frequency',
          { role: 'tooltip' }
        ])
        this.c1options.vAxis.scaleType = 'log'
        fi.termFreqQuantiles!.forEach((q, i) =>
          this.c1data.push([
            parseFloat(q.quantile) * 100,
            fi.docFreqQuantiles![i].freq,
            +(parseFloat(q.quantile) * 100).toFixed(2) +
              '% of values for ' +
              fieldName +
              ' appear in <=' +
              fi.docFreqQuantiles![i].freq +
              ' documents',
            q.freq,
            +(parseFloat(q.quantile) * 100).toFixed(2) +
              '% of values for ' +
              fieldName +
              ' appear <=' +
              q.freq +
              ' times overall'
          ])
        )
      }
    }
  }
}

@Component({
  localStorage: localStorageConfig,
  components: {
    MyGChart,
    ...VCard,
    ...VBtn,
    ...VTextField,
    ...VTextarea,
    ...VSelect,
    ...VDataTable,
    ...VAlert,
    ...VCheckbox,
    ...VTabs
  }
})
export default class Overview extends AbstractView {
  protected params = {
    maxTermsToStat: 30,
    quantiles: true,
    histograms: true,
    stats: true,
    endpoint: '',
    level: '',
    by: '0.1'
  }
  private fields: FieldData[] = []
  private result?: ILevelInfo = undefined
  private totalDocs: number = -1
  private headers = [
    { text: 'term', value: 'term' },
    { text: 'total document frequency', value: 'TDF' },
    { text: 'total term frequency', value: 'TTF' }
  ]
  private async search() {
    this.loading = true
    this.error = null
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq))
      this.$router.push({
        name: 'overview',
        query: nq
      })
    try {
      const response = await axios.get(this.params.endpoint + 'indexInfo', {
        params: this.params,
        auth: this.auths[this.params.endpoint]
      })
      this.request =
        response.config.url + '?pretty&' + response.config.paramsSerializer!(response.config.params)
      this.loading = false
      this.result = response.data.result
      this.fields = []
      this.totalDocs = response.data.result.documents
      for (let field in response.data.result.fields) {
        this.fields.push(
          new FieldData(field, response.data.result.fields[field], (field, term) => {
            let fields = this.$route.query.fields
            if (!fields) fields = [field]
            else if (!Array.isArray(fields)) fields = [fields, field]
            else fields.push(field)
            const routeData = this.$router.resolve({
              name: 'search',
              query: Object.assign({}, this.$route.query, {
                field: field,
                query: field + ':"' + term + '"'
              })
            })
            window.open(routeData.href, '_blank')
          })
        )
      }
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
      if (this.params.endpoint) this.search()
    }
  }
  @Watch('indexInfo')
  private onIndexInfoChanged(): void {
    if (this.indexInfo) {
      this.params.level = this.indexInfo.levels.find(
        (l: ILevelInfo) => l.id === this.indexInfo!.defaultLevel
      )!.id
      this.search()
    }
  }
}
</script>
