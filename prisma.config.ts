import { defineConfig } from "prisma/config";

export default defineConfig({
  // IMPORTANT: Use the Node query engine (no adapter/accelerate required)
  engineType: "binary",

  // Your schema path
  schema: "prisma/schema.prisma",
});
