<script setup lang="ts">
import { RouterLink } from "vue-router";
import JobListing from "./JobListing.vue";
import { onMounted, reactive } from "vue";
import PulseLoader from "vue-spinner/src/PulseLoader.vue";
import axios from "axios";
import { computed, type ComputedRef } from "vue";
import type { JobType } from "@/types/job";

// const props = defineProps({
//   limit: Number,
// });

const props = defineProps<{
  limit?: number; // in ts number, in js Number
}>();

const showButton: ComputedRef<boolean> = computed(
  () => props.limit !== undefined
);
// in script verwendet showButton.value im template nur showButton
// computed ist reaktiv, d.h. wenn sich props.limit ändert, ändert sich showButton
// bei let würde sich DOM nicht automatisch aktualisieren

const state = reactive<{
  jobs: JobType[];
  isLoading: boolean;
}>({
  jobs: [],
  isLoading: true,
});

// const state = reactive{
//   jobs: [],
//   isLoading: true,
// });
// reactive für objekte mit tiefen daten. bei ref ist nur die oberste ebene reaktiv.
// const jobs = ref(jobData);
// const jobs = ref([]);

onMounted(async () => {
  // onMounted führt diese Funktion aus, wenn die Komponente das erste Mal vollständig im DOM ist
  try {
    const response = await axios.get<JobType[]>("/api/jobs");
    state.jobs = response.data;
  } catch (error) {
    console.error("Error fetching jobs", error);
  } finally {
    state.isLoading = false;
  }
});

const showLoading = () => {
  state.isLoading = true;
};
</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <h2 class="text-3xl font-bold text-green-500 mb-6 text-center">
        Browse Jobs
      </h2>
      <!-- Show loading spinner while loading is true -->
      <div v-if="state.isLoading" class="text-center text-gray-500 py-6">
        <PulseLoader />
      </div>
      <!-- Show job listing when done loading -->
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <JobListing
          v-for="job in state.jobs.slice(0, props.limit || state.jobs.length)"
          :key="job.id"
          :job="job"
        />
      </div>
    </div>
    <!-- Doppelpunkt macht Wert dynamisch statt statisch und verwendet js -->
  </section>

  <section v-if="showButton" class="m-auto max-w-lg my-10 px-6">
    <!-- kein attribut, daher kein : -->
    <RouterLink
      to="/jobs"
      class="block bg-black text-white text-center py-4 px-6 rounded-xl hover:bg-gray-700"
      >View All Jobs</RouterLink
    >
    <!-- v-if ist selbst schon dynamisch -->
  </section>

  <section class="m-auto max-w-lg my-10 px-6">
    <button @click="showLoading">Laden anzeigen</button>
  </section>
</template>
