<template lang="pug">
v-app
  v-toolbar(color='indigo', dark, fixed, app)
    v-toolbar-title Octavo UI
    v-spacer
    v-toolbar-items
      v-btn(flat,:to="{path:'/terms',query:$route.query}") Term Discovery
      v-btn(flat,:to="{path:'/search',query:$route.query}") Search
      v-btn(flat,:to="{path:'/stats',query:$route.query}") Statistics
      v-btn(flat,:to="{path:'/kwic',query:$route.query}") KWIC
      v-btn(flat,:to="{path:'/vocabulary',query:$route.query}") Vocabulary
      v-btn(flat,:to="{path:'/',query:$route.query}") Settings
  v-content: v-container(fluid)
    router-view
  v-footer(color='indigo', app)
    span.white--text &nbsp;© 2017 Eetu Mäkelä
</template>
<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import * as VFooter from 'vuetify/es5/components/VFooter'
import * as VBtn from 'vuetify/es5/components/VBtn'
import * as VToolbar from 'vuetify/es5/components/VToolbar'

@Component({
  components: {
    ...VFooter,
    ...VBtn,
    ...VToolbar
  }
})
export default class App extends Vue {}
</script>
