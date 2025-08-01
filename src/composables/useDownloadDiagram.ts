import { ShallowRef } from "vue";
import Viewer from "bpmn-js/lib/Viewer";

export function useDownloadDiagram(viewer: ShallowRef<Viewer | null>) {
  const downloadDiagram = async (fileName: string | null) => {
    const xml = await viewer.value?.saveXML({ format: true });

    if (!xml?.xml) {
      throw new Error("Keine XML-Daten vorhanden.");
    }
    if (!fileName) {
      throw new Error("FileName nicht vorhanden.");
    }

    const blob = new Blob([xml.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return { downloadDiagram };
}
