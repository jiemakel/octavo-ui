<template lang="pug">
GChart(@ready="onChartReady",:type="type",:options="options",:data="data",:events="wrappedEvents")
</template>
<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import { GChart } from 'vue-google-charts'

@Component({
  components: {
    GChart
  }
})
export default class MyGChart extends Vue {
  @Prop()
  private options!: any
  @Prop()
  private type!: string
  @Prop()
  private data!: any[][]
  @Prop()
  private events!: any
  private get wrappedEvents() {
    const ret: {[event:string]:() => void} = {}
    for (const e in this.events) ret[e] = () => this.events[e](this.el)
    return ret
  }
  private el: any
  private onChartReady(el: any, google: any) {
    this.el = el
  }
}
</script>
