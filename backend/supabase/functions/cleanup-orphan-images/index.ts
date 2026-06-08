import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const bucket = "scan-images";

  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list("", { limit: 1000 });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const now = Date.now();

  for (const file of files ?? []) {
    if (!file.created_at) continue;

    const ageHours =
      (now - new Date(file.created_at).getTime()) /
      (1000 * 60 * 60);

    if (ageHours < 24) continue;

    const { data: scan } = await supabase
      .from("scans")
      .select("id")
      .contains("photo_urls", [file.name])
      .maybeSingle();

    if (!scan) {
      await supabase.storage
        .from(bucket)
        .remove([file.name]);

      console.log(`Deleted orphan image: ${file.name}`);
    }
  }

  return new Response("Cleanup completed");
});