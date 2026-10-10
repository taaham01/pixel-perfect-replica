import { createFileRoute } from "@tanstack/react-router";
import { publicClient } from "@/lib/supabase-public.server";

const SAFE = /^vehicles\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,80}\.(webp|jpe?g|png)$/;

/** Serves vehicle photos from the private storage bucket with long-lived caching. */
export const Route = createFileRoute("/api/public/images/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!SAFE.test(path)) return new Response("Not found", { status: 404 });
        const { data, error } = await publicClient().storage.from("vehicle-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "content-type": data.type || "image/webp",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
