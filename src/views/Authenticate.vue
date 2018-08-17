<template lang="pug">
div
  h2 Endpoint {{ $route.query.endpoint }} requires authentication
  b-form-group(:state="isAuthenticationValid",label="Username",label-for="username")
    b-form-input(id="username",:state="isAuthenticationValid",type="text",v-model="username")
  b-form-group(:state="isAuthenticationValid",label="Password",label-for="password")
    b-form-input(id="password",:state="isAuthenticationValid",type="password",v-model="password")
  b-button(:to="returnTo",:disabled="!isAuthenticationValid",:variant="isAuthenticationValid ? 'success' : 'danger'") Login
  div(v-show="error")
    | Unexpected error accessing endpoint {{endpoint}}: {{error}}
</template>
<script lang="ts">
import axios from 'axios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import { AuthInfo } from '@/common/AuthInfo'
@Component({
  localStorage: localStorageConfig
})
export default class Authenticate extends Vue {
  private username = ''
  private password = ''
  @Prop() private returnTo!: string
  @Prop() private endpoint!: string
  private error: string = ''
  private isAuthenticationValid = false
  private get authenticationInfoChanged() {
    return this.username + this.password
  }
  @Watch('authenticationInfoChanged')
  private onAuthenticationInfoChanged(): void {
    this.isAuthenticationValid = false
    axios
      .get(this.endpoint + 'indexInfo', {
        auth: {
          username: this.username,
          password: this.password
        }
      })
      .then(() => {
        this.isAuthenticationValid = true
        const auths = this.$localStorage.get('auths')
        auths[this.endpoint] = new AuthInfo(this.username, this.password)
        this.$localStorage.set('auths', auths)
      })
      .catch(error => {
        if (!error || !error.response || error.response.status !== 401)
          this.error = error
      })
  }
}
</script>
<style lang="stylus" scoped>
</style>
