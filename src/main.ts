import '@babel/polyfill'
import Vue from 'vue'
import VueLocalStorage from 'vue-localstorage'
import './plugins/vuetify'
import App from './App.vue'
import router from './router'
import store from './store'
Vue.use(VueLocalStorage)

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
