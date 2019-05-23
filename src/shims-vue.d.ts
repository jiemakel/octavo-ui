import { VueLocalStorage } from 'vue-localstorage'
import Vue from 'vue'

declare module '*.vue' {
  export default Vue
}

declare module 'vue/types/options' {
  interface ComponentOptions<V extends Vue> {
    localStorage?: { [id: string]: string | { type: Function; default: any } }
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $localStorage: VueLocalStorage
  }
  interface VueConstructor {
    localStorage: VueLocalStorage
  }
}
