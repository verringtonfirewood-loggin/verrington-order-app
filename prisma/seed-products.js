const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const defaults = [
    {
      name: "Net of Logs",
      description: "Perfect for occasional fires. Easy to store and handle.",
      pricePence: 2000,
      sortOrder: 10,
      isActive: true,
    },
    {
      name: "Bulk Bag of Logs",
      description: "Best value for regular burners. Seasoned hardwood.",
      pricePence: 10000,
      sortOrder: 20,
      isActive: true,
    },
    {
      name: "IBC Crate",
      description: "A full IBC crate of loose-tipped, fully seasoned logs.",
      pricePence: 19500,
      sortOrder: 30,
      isActive: true,
    },
  ];

  for (const p of defaults) {
    const existing = await prisma.product.findFirst({
      where: { name: p.name },
    });

    if (!existing) {
      await prisma.product.create({ data: p });
      console.log(`✅ Created: ${p.name}`);
    } else {
      console.log(`↪️ Exists: ${p.name}`);
    }
  }

  const count = await prisma.product.count();
  console.log(`\nTotal products: ${count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
