import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import NotFoundView from "@/views/NotFoundView.vue";
import BpmnViewerView from "@/views/BpmnViewerView.vue";
import BpmnAnalysisView from "@/views/BpmnAnalysisView.vue";
import PathDiagramView from "@/views/PathDiagramView.vue";

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
      component: BpmnAnalysisView,
    },
    {
      path: "/analysis/path-diagram",
      name: "pathdiagram",
      component: PathDiagramView,
    },
    {
      path: "/:catchAll(.*)",
      name: "not-found",
      component: NotFoundView,
    },
  ],
});

export default router;
