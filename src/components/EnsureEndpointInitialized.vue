<template lang="pug">
div
  div(v-show="state == 'loading'") Loading ...
  div(v-show="state == 'error'") Error: <pre>{{ error }}</pre>
  div(v-show="state == 'ready'"): slot
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import axios, { AxiosResponse } from 'axios'
import { AuthInfo } from '@/common/AuthInfo'
import localStorageConfig from '@/common/localstorage-config'
import { IIndexInfo, setIndexInfo } from '@/store'
@Component({
  localStorage: localStorageConfig
})
export default class EnsureEndpointInfo extends Vue {
  private error: string = ''
  get state() {
    if (this.$store.state.endpoint == this.$route.query.endpoint) return 'ready'
    if (!this.$route.query.endpoint) this.error = 'No endpoint given!'
    if (this.error) return 'error'
    const endpoint = this.$route.query.endpoint as string
    const auth: AuthInfo = this.$localStorage.get('auths')[endpoint]
    axios
      .get(endpoint + 'indexInfo', { auth })
      .then((response: AxiosResponse<IIndexInfo>) => {
        setIndexInfo(this.$store, {
          endpoint,
          indexInfo: response.data,
          auth
        })
      })
      .catch(error => {
        if (error && error.response && error.response.status === 401)
          this.$router.push({
            name: 'auth',
            query: { returnTo: this.$route.fullPath, endpoint }
          })
        this.error = error
      })
    return 'loading'
  }
}
</script>

<style scoped lang="stylus">
</style>
