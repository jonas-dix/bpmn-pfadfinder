import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import BpmnViewerView from "../views/BpmnViewerView.vue";
import BpmnAnalysisView from "../views/BpmnAnalysisView.vue";
import PathViewView from "../views/PathViewView.vue";

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
      path: "/analysis/path-view",
      name: "pathview",
      component: PathViewView,
    },
    {
      path: "/:catchAll(.*)",
      name: "not-found",
      component: NotFoundView,
    },
  ],
});

export default router;
