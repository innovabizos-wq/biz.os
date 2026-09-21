import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["src/modules/billing/xml/schemas/**/*"],
  },
  serverExternalPackages: ["xmllint-wasm"],
};

export default withWorkflow(nextConfig);
