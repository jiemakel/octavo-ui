import '@babel/polyfill'
import Vue from 'vue'
import VueLocalStorage from 'vue-localstorage'
import numFormat from 'vue-filter-number-format'
import '@/plugins/vuetify'
import App from '@/App.vue'
import router from '@/router'

Vue.use(VueLocalStorage)
Vue.filter('numFormat', numFormat)

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
