<template lang="pug">
v-form: v-container: v-layout(column)
    v-text-field(label="Endpoint",v-model="endpoint",:error="!isEndpointValid")
    div(v-show="requireAuthentication")
        span.subheading The address seems to require authentication
        v-text-field(label="Username",v-model="username",:error="!isAuthenticationValid")
        v-text-field(type="password",label="Password",v-model="password",:error="!isAuthenticationValid")
</template>

<script lang="ts">
import axios from 'axios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import { AuthInfo } from '@/common/AuthInfo'
import debounce from 'lodash/debounce'
import localStorageConfig from '@/common/localstorage-config'

@Component({
  localStorage: localStorageConfig
})
export default class Settings extends Vue {
  @Prop({ default: '' })
  public initialEndpoint!: string
  private endpoint: string = this.initialEndpoint
  private isEndpointValid: boolean = true
  private isAuthenticationValid: boolean = true
  private currentAuthInfo: AuthInfo = this.$localStorage.get('auths')[
    this.endpoint
  ]
  private username = this.currentAuthInfo ? this.currentAuthInfo.username : ''
  private password = this.currentAuthInfo ? this.currentAuthInfo.password : ''
  private requireAuthentication = this.currentAuthInfo ? true : false
  constructor() {
    super()
    this.onAuthInfoChanged = debounce(this.onAuthInfoChanged, 500)
    this.onEndpointChanged = debounce(this.onEndpointChanged, 500)
  }
  private get authenticationInfoChanged() {
    return this.username + this.password
  }
  @Watch('requireAuthentication', { immediate: true })
  @Watch('authenticationInfoChanged')
  private onAuthInfoChanged(): void {
    if (this.requireAuthentication)
      axios
        .get(this.endpoint + 'indexInfo', {
          auth: {
            username: this.username,
            password: this.password
          }
        })
        .then(response => {
          this.isAuthenticationValid = true
          if (response.data.indexType) {
            this.isEndpointValid = true
            const auths = this.$localStorage.get('auths')
            auths[this.endpoint] = new AuthInfo(this.username, this.password)
            this.$localStorage.set('auths', auths)
            this.$router.replace({
              path: '/',
              query: { endpoint: this.endpoint }
            })
          }
        })
        .catch(error => {
          this.isAuthenticationValid = !(
            error &&
            error.response &&
            error.response.status === 401
          )
          this.isEndpointValid = false
        })
  }
  @Watch('endpoint', { immediate: true })
  private onEndpointChanged() {
    this.requireAuthentication = false
    this.isEndpointValid = true
    if (this.endpoint !== '')
      axios
        .get(this.endpoint + 'indexInfo')
        .then(response => {
          if (response.data.indexType) {
            this.isEndpointValid = true
            this.requireAuthentication = false
            const auths = this.$localStorage.get('auths')
            delete auths[this.endpoint]
            this.$localStorage.set('auths', auths)
            this.$router.replace({
              path: '/',
              query: { endpoint: this.endpoint }
            })
          } else this.isEndpointValid = false
        })
        .catch(error => {
          if (error && error.response && error.response.status === 401)
            this.requireAuthentication = true
          else this.isEndpointValid = false
        })
  }
}
</script>
