import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no incremental cache override. Good enough for a first deploy;
// wire R2/KV here later if ISR/`revalidate` caching is needed.
export default defineCloudflareConfig();
