import Vue from 'vue'
import axios, { AxiosResponse, AxiosBasicCredentials, AxiosError } from 'axios'
import router from '@/router'

export enum IndexingType {
  TEXT = 'TEXT',
  STRING = 'STRING',
  INTPOINT = 'INTPOINT',
  LONGPOINT = 'LONGPOINT',
  FLOATPOINT = 'FLOATPOINT',
  DOUBLEPOINT = 'DOUBLEPOINT',
  NONE = 'NONE'
}

export enum StoreType {
  NUMERICDOCVALUES = 'NUMERICDOCVALUES',
  FLOATDOCVALUES = 'FLOATDOCVALUES',
  DOUBLEDOCVALUES = 'DOUBLEDOCVALUES',
  SORTEDDOCVALUES = 'SORTEDDOCVALUES',
  SORTEDNUMERICDOCVALUES = 'SORTEDNUMERICDOCVALUES',
  SORTEDSETDOCVALUES = 'SORTEDSETDOCVALUES',
  SINGULARSTOREDFIELD = 'SINGULARSTOREDFIELD',
  MULTIPLESTOREDFIELDS = 'MULTIPLESTOREDFIELDS',
  TERMVECTOR = 'TERMVECTOR',
  NONE = 'NONE'
}

export interface IFieldInfo {
  description: string
  indexedAs: IndexingType
  storedAs: StoreType
  containsJson: boolean
  totalTerms?: number
  termFreqQuantiles?: {
    quantile: string
    freq: number
  }[]
  termFreqs?: {
    term: string
    docFreq: number
    totalTermFreq: number
  }[]
  docFreqQuantiles?: {
    quantile: string
    freq: number
  }[]
  quantiles?: {
    quantile: string
    max: number
  }[]
  histogram?: {
    min: number
    max: number
    proportion: number
  }[]
  min?: number
  max?: number
  totalDocs?: number
  sumDocFreq?: number
  sumTotalTermFreq?: number
}

export interface ILevelInfo {
  id: string
  idField: string
  description: string
  fields: { [fieldId: string]: IFieldInfo }
}

export interface IIndexInfo {
  name: string
  version: string
  levels: ILevelInfo[]
  defaultLevel: string
  commonFields: { [fieldId: string]: IFieldInfo }
  contentField: string
  contentTokensField: string
  indexingAnalyzers: { [fieldId: string]: string }
}

export class State {
  public indexInfos: { [endpoint: string]: IIndexInfo | undefined } = {}
  public async loadIndexInfo(endpoint: string) {
    const auth = Vue.localStorage.get('auths')[endpoint]
    if (!this.indexInfos[endpoint])
      try {
        const response = await axios.get(
          endpoint + 'indexInfo?quantiles&histograms&stats&by=0.01&maxTermsToStat=20',
          { auth }
        )
        Vue.set(this.indexInfos, endpoint, response.data.result)
      } catch (error) {
        if (error && error.response && error.response.status === 401)
          router.push({
            name: 'auth',
            query: {
              returnTo: router.currentRoute.fullPath,
              endpoint
            }
          })
        else throw error
      }
    const endpoints: { [endpoint: string]: string } = Vue.localStorage.get('endpoints')
    endpoints[endpoint] = this.indexInfos[endpoint]!.name
    Vue.localStorage.set('endpoints', endpoints)
  }
}

export default new State()
