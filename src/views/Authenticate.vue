<template lang="pug">
div
  h2 Endpoint {{ $route.query.endpoint }} requires authentication
  v-text-field(label="Username",v-model="username",:error="!isAuthenticationValid")
  v-text-field(type="password",label="Password",v-model="password",:error="!isAuthenticationValid")
  v-btn(:to="returnTo",:disabled="!isAuthenticationValid",:color="isAuthenticationValid ? 'success' : 'error'") Login
  div(v-show="error")
    | Unexpected error accessing endpoint {{endpoint}}: {{error}}
</template>
<script lang="ts">
import axios from 'axios'
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import localStorageConfig from '@/common/localstorage-config'
import { AuthInfo } from '@/common/AuthInfo'
import * as VTextField from 'vuetify/es5/components/VTextField'
import * as VBtn from 'vuetify/es5/components/VBtn'
@Component({
  localStorage: localStorageConfig,
  components: {
    ...VTextField,
    ...VBtn
  }
})
export default class Authenticate extends Vue {
  private username = ''
  private password = ''
  @Prop()
  private returnTo!: string
  @Prop()
  private endpoint!: string
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
