import { defineConfig } from "prisma/config";

export default defineConfig({
  // Prisma 7: config-first datasource
  datasource: {
    url: process.env.DATABASE_URL,
  },

  // Use Node query engine (no adapter/accelerate required)
  engineType: "binary",

  schema: "prisma/schema.prisma",
});
