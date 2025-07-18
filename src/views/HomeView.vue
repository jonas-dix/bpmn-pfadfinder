<script setup lang="ts">
import Hero from "@/components/Hero.vue";
</script>

<template>
  <Hero title="BPMN-Pfadfinder" subtitle="Extrahiere alle Pfade" />
  <section class="m-auto max-w-lg my-10 px-6">
    <RouterLink
      to="/viewer"
      class="block bg-black text-white text-center py-4 px-6 rounded-xl hover:bg-gray-700 mb-4"
    >
      Anzeigen vom BPMN-Diagrammen
    </RouterLink>
    <RouterLink
      to="/analysis"
      class="block bg-black text-white text-center py-4 px-6 rounded-xl hover:bg-gray-700"
    >
      Analysieren vom BPMN-Diagrammen
    </RouterLink>
  </section>
</template>
