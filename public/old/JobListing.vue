<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ref, computed, type ComputedRef } from "vue";
import type { JobType } from "@/types/bpmn";

// const props = defineProps({
//   job: Object,
// });

const props = defineProps<{
  job: JobType;
}>();

const showFullDescription = ref(false);

const truncatedDescription: ComputedRef<string> = computed(() => {
  let description = props.job.description;
  if (!showFullDescription.value) {
    description = description.substring(0, 90) + " ...";
  }
  return description;
});
// berechnete Eigenschaft. automatisch neu berechnet durch computed wenn abhängigkeit sich ändert.
// truncatedDescription ist ein ref-objekt mit .vaue wert.

const toggleFullDescription = (): void => {
  showFullDescription.value = !showFullDescription.value;
};
</script>

<template>
  <div class="bg-white rounded-xl shadow-md relative">
    <div class="p-4">
      <div class="mb-6">
        <div class="text-gray-600 my-2">{{ job.type }}</div>
        <h3 class="text-xl font-bold">{{ job.title }}</h3>
      </div>

      <div class="mb-5">
        <div>{{ truncatedDescription }}</div>
        <button
          @click="toggleFullDescription"
          class="text-green-500 hover:text-green-600 mb-5"
        >
          {{ showFullDescription ? "Less" : "More" }}
          <!-- innerhalb von {{  }} können js ausdrücke aber nicht anweisungen stehen-->
        </button>
      </div>

      <h3 class="text-green-500 mb-2">{{ job.salary }} / Year</h3>

      <div class="border border-gray-100 mb-5"></div>

      <div class="flex flex-col lg:flex-row justify-between mb-4">
        <div class="text-orange-700 mb-3">
          <i class="pi pi-map-marker text-orange-700"></i>
          {{ job.location }}
        </div>
        <RouterLink
          :to="'/jobs/' + job.id"
          class="h-[36px] bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-center text-sm"
        >
          Read More
        </RouterLink>
      </div>
    </div>
  </div>
</template>
