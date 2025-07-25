import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import BpmnViewerView from "../views/BpmnViewerView.vue";
import JobsView from "@/views/JobsView.vue";
import BpmnAnalysis from "@/views/BpmnAnalysisView.vue";
import JobView from "@/views/JobView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/viewer",
      name: "viewer",
      component: BpmnViewerView,
    },
    {
      path: "/analysis",
      name: "analysis",
      component: BpmnAnalysis,
    },
    {
      path: "/jobs",
      name: "jobs",
      component: JobsView,
    },
    {
      path: "/jobs/:id",
      name: "job",
      component: JobView,
    },
    {
      path: "/:catchAll(.*)",
      name: "not-found",
      component: NotFoundView,
    },
  ],
});

export default router;
