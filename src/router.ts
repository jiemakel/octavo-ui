import Settings from '@/views/Settings.vue'
import Vue from 'vue'
import Router from 'vue-router'
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
      component: () =>
        import(/* webpackChunkName: "terms" */ '@/views/Terms.vue')
    },
    {
      path: '/search',
      name: 'search',
      component: () =>
        import(/* webpackChunkName: "search" */ '@/views/Search.vue')
    },
    {
      path: '/kwic',
      name: 'kwic',
      component: () => import(/* webpackChunkName: "kwic" */ '@/views/KWIC.vue')
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
