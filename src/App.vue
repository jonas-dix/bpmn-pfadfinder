<script setup lang="ts">
import Navbar from "@/components/Navbar.vue";
</script>

<template>
  <Navbar />
  <RouterView />
</template>

<style>
.djs-element.highlight[data-type="bpmn:SequenceFlow"] > .djs-visual > path {
  stroke: rgb(255, 165, 0) !important;
  stroke-width: 4px !important;
  fill: none !important;
}

.djs-element.highlight[data-type="bpmn:SequenceFlow"] .djs-marker {
  stroke: rgb(255, 165, 0) !important;
  fill: rgb(255, 165, 0) !important;
}
</style>
