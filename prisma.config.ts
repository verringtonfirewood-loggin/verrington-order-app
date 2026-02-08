import { defineConfig } from "prisma/config";

export default defineConfig({
  // Prisma 7: use the Node query engine (no adapter/accelerate required)
  engineType: "binary",

  schema: "prisma/schema.prisma",
});
