import Vue from 'vue'
import Vuetify from 'vuetify/es5/components/Vuetify'
import VApp from 'vuetify/es5/components/VApp'
import VGrid from 'vuetify/es5/components/VGrid'
import transitions from 'vuetify/es5/components/transitions'
import 'vuetify/src/stylus/app.styl'

Vue.use(Vuetify, {
  components: {
    VApp,
    VGrid,
    transitions
  }
})
