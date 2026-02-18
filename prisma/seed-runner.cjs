// prisma/seed-runner.cjs

// 1️⃣ Load environment variables FIRST
require("dotenv").config();

// 2️⃣ Register ts-node
require("ts-node/register/transpile-only");

// 3️⃣ Run seed
require("./seed.ts");
