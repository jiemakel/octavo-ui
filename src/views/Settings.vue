<template lang="pug">
v-container: v-layout(column)
  h1 Add endpoint
  v-text-field(label="Endpoint",v-model="params.endpoint",:error="!isEndpointValid",:success-messages="currentEndpointNames")

  div(v-show="requireAuthentication")
      span.subheading The address seems to require authentication
      v-text-field(label="Username",v-model="username",:error="!isAuthenticationValid")
      v-text-field(type="password",label="Password",v-model="password",:error="!isAuthenticationValid")
  v-btn(:disabled="!isEndpointValid",@click="addEndpoints()") Add
  h1 Endpoints
  v-list: v-list-tile(v-for="(name,endpoint) in endpoints")
    v-list-tile-content
      v-list-tile-title {{name}}
      v-list-tile-sub-title {{endpoint}}
    v-list-tile-action: v-icon(@click="removeEndpoint(endpoint)") delete
</template>

<script lang="ts">
import { isEqual } from 'lodash-es'
import axios, { AxiosBasicCredentials } from 'axios'
import { AxiosResponse } from 'axios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import { debounce } from 'lodash-es'
import localStorageConfig from '@/common/localstorage-config'
import * as VTextField from 'vuetify/es5/components/VTextField'
import * as VGrid from 'vuetify/es5/components/VGrid'
import * as VBtn from 'vuetify/es5/components/VBtn'
import * as VList from 'vuetify/es5/components/VList'
import * as VIcon from 'vuetify/es5/components/VIcon'

@Component({
  localStorage: localStorageConfig,
  components: {
    ...VTextField,
    ...VGrid,
    ...VBtn,
    ...VList,
    ...VIcon
  }
})
export default class Settings extends Vue {
  private isEndpointValid: boolean = true
  private isAuthenticationValid: boolean = true
  private params = {
    endpoint: ''
  }
  private username: string
  private password: string
  private requireAuthentication: boolean
  private endpoints: { [id: string]: string } = this.$localStorage.get('endpoints')
  private removeEndpoint(endpoint: string): void {
    Vue.delete(this.endpoints, endpoint)
  }
  private currentEndpoints: { [id: string]: string } = {}
  private get currentEndpointNames() {
    const ret: string[] = []
    for (let endpoint in this.currentEndpoints) ret.push(this.currentEndpoints[endpoint])
    return ret.join(', ')
  }
  private addEndpoints(): void {
    for (let endpoint in this.currentEndpoints)
      Vue.set(this.endpoints, endpoint, this.currentEndpoints[endpoint])
  }
  @Watch('endpoints', { deep: true })
  private onEndpointsChanged(): void {
    this.$localStorage.set('endpoints', this.endpoints)
  }
  constructor() {
    super()
    const auth = this.$localStorage.get('auths')[this.params.endpoint]
    this.username = auth ? auth.username : ''
    this.password = auth ? auth.password : ''
    this.requireAuthentication = auth ? true : false
    this.onAuthInfoChanged = debounce(this.onAuthInfoChanged, 500)
    this.onEndpointChanged = debounce(this.onEndpointChanged, 500)
  }
  private get authenticationInfoChanged() {
    return this.username + this.password
  }
  @Watch('requireAuthentication', { immediate: true })
  @Watch('authenticationInfoChanged')
  private async onAuthInfoChanged() {
    if (this.requireAuthentication)
      try {
        const response = await axios.get(this.params.endpoint, {
          auth: {
            username: this.username,
            password: this.password
          }
        })
        this.isAuthenticationValid = true
        if (response.data.indexType) {
          this.isEndpointValid = true
          Vue.set(this.currentEndpoints, this.params.endpoint, response.data.name)
          const auths = this.$localStorage.get('auths')
          auths[this.params.endpoint] = {
            username: this.username,
            password: this.password
          }
          this.$localStorage.set('auths', auths)
          this.$router.replace({
            path: '/',
            query: Object.assign({}, this.params, {
              endpoint: this.params.endpoint
            })
          })
        } else if (response.data.indices) {
          this.isEndpointValid = true
          const auths = this.$localStorage.get('auths')
          auths[this.params.endpoint] = {
            username: this.username,
            password: this.password
          }
          this.$localStorage.set('auths', auths)
          for (let endpoint in response.data.indices)
            Vue.set(
              this.currentEndpoints,
              this.params.endpoint + endpoint + '/',
              response.data.indices[endpoint].name
            )
        }
      } catch (error) {
        this.isAuthenticationValid = !(error && error.response && error.response.status === 401)
        this.isEndpointValid = false
      }
  }
  @Watch('$route.query', { immediate: true })
  private onQueryChanged(): void {
    let nq = Object.assign({}, this.$route.query, this.params)
    if (!isEqual(this.$route.query, nq)) Object.assign(this.params, this.$route.query)
  }
  @Watch('params.endpoint', { immediate: true })
  private async onEndpointChanged() {
    this.requireAuthentication = false
    this.isEndpointValid = true
    this.currentEndpoints = {}
    if (this.params.endpoint !== '')
      try {
        const response = await axios.get(this.params.endpoint)
        if (!this.params.endpoint.endsWith('/')) this.params.endpoint = this.params.endpoint + '/'
        if (response.data.result && response.data.result.indexType) {
          Vue.set(this.currentEndpoints, this.params.endpoint, response.data.result.name)
          this.isEndpointValid = true
          this.requireAuthentication = false
          const auths = this.$localStorage.get('auths')
          delete auths[this.params.endpoint]
          this.$localStorage.set('auths', auths)
          this.$router.replace({
            path: '/',
            query: Object.assign({}, this.params, {
              endpoint: this.params.endpoint
            })
          })
        } else if (response.data.indices) {
          this.isEndpointValid = true
          this.requireAuthentication = false
          const auths = this.$localStorage.get('auths')
          delete auths[this.params.endpoint]
          this.$localStorage.set('auths', auths)
          for (let endpoint in response.data.indices)
            Vue.set(
              this.currentEndpoints,
              this.params.endpoint + endpoint + '/',
              response.data.indices[endpoint]
            )
        } else this.isEndpointValid = false
      } catch (error) {
        if (error && error.response && error.response.status === 401)
          this.requireAuthentication = true
        else this.isEndpointValid = false
      }
  }
}
</script>
