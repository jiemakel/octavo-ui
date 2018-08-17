<template lang="pug">
v-app
  v-toolbar(color='indigo', dark, fixed, app)
    v-toolbar-title Octavo UI
    v-spacer
    v-toolbar-items
      v-btn(flat,:to="{path:'/terms',query:$route.query}") Term Discovery
      v-btn(flat,:to="{path:'/search',query:$route.query}") Search
      v-btn(flat,:to="{path:'/stats',query:$route.query}") Statistics
      v-btn(flat,:to="{path:'/vocabulary',query:$route.query}") Vocabulary
      v-btn(flat,:to="{path:'/',query:$route.query}") Settings
  v-content: v-container(fluid)
    router-view
  v-footer(color='indigo', app)
    span.white--text &nbsp;© 2017 Eetu Mäkelä
</template>
