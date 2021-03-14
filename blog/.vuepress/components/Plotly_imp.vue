<template>
  <Plotly :data="data" :layout="layout" :display-mode-bar="false"></Plotly>
</template>

<script setup>
  import { Plotly } from 'vue-plotly'

  export default {
    components: {
      Plotly
    },
    data: function() {
      return {data: [{
        x: [1,2,3,4],
        y: [10,15,13,17],
        type:"scatter"
      }],
      layout:{
        title: "My graph"
      }
    }}
  }
</script>




