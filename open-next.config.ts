import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: every page reads the signed-in user's session, so
// there's nothing worth caching between requests yet. Revisit (R2 or the
// static-assets cache) if we add shared, cacheable pages.
// See https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
