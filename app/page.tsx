import { VideoUploadInterface } from "@/components/video-upload-interface";
import { PrometheusShell } from "@/components/prometheus-shell";

export default function HeroPage() {
  return (
    <PrometheusShell>
      <VideoUploadInterface />
    </PrometheusShell>
  );
}
