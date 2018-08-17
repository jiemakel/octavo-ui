import Settings from '@/views/Settings.vue'
import Vue from 'vue'
import Router from 'vue-router'
import Search from '@/views/Search.vue'
import Terms from '@/views/Terms.vue'
import Authenticate from '@/views/Authenticate.vue'

Vue.use(Router)

export default new Router({
  base: window.location.pathname,
  routes: [
    {
      path: '/',
      name: 'settings',
      component: Settings,
      props: route => ({
        initialEndpoint: route.query.endpoint
      })
    },
    {
      path: '/terms',
      name: 'terms',
      component: Terms
    },
    {
      path: '/search',
      name: 'search',
      component: Search
    },
    {
      path: '/auth',
      name: 'auth',
      component: Authenticate,
      props: route => ({
        endpoint: route.query.endpoint,
        returnTo: route.query.returnTo
      })
    }
  ]
})
