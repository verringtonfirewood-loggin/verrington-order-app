// prisma/seed.js
// IMPORTANT: use the app's configured Prisma client (Prisma 7 requires adapter/accelerate in some setups)
const prismaModule = require("../src/lib/prisma");
const prisma = prismaModule.default || prismaModule;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function shouldReset() {
  return process.env.SEED_RESET === "1";
}

function assertNotProduction() {
  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  const prodLike = nodeEnv === "production" || vercelEnv === "production";
  if (prodLike && shouldReset()) {
    throw new Error(
      "Refusing to run destructive seed in production (SEED_RESET=1). Remove SEED_RESET or use a dev database."
    );
  }
}

async function main() {
  assertNotProduction();

  const reset = shouldReset();

  if (!reset) {
    const existingOrders = await prisma.order.count();
    const existingProducts = await prisma.product.count();
    if (existingOrders > 0 || existingProducts > 0) {
      console.log(
        `ℹ️ Seed skipped (DB not empty). Set SEED_RESET=1 to wipe + reseed. orders=${existingOrders}, products=${existingProducts}`
      );
      return;
    }
  }

  if (reset) {
    console.log("⚠️ SEED_RESET=1 -> wiping dev data before seeding...");

    await prisma.husbandryLog.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.orderCounter.deleteMany();
  }

  await prisma.orderCounter.upsert({
    where: { id: 1 },
    create: { id: 1, next: 37 },
    update: { next: 37 },
  });

  await prisma.product.createMany({
    data: [
      {
        name: "Bulk Bag of Logs",
        description: "Seasoned hardwood bulk bag",
        pricePence: 17500,
        isActive: true,
        sortOrder: 1,
        imageAlt: "Bulk bag of logs",
        imageUrl: null,
      },
      {
        name: "IBC Crate",
        description: "Seasoned hardwood in an IBC crate",
        pricePence: 19500,
        isActive: true,
        sortOrder: 2,
        imageAlt: "IBC crate of logs",
        imageUrl: null,
      },
      {
        name: "Net of Logs",
        description: "Convenient net of seasoned logs",
        pricePence: 1000,
        isActive: true,
        sortOrder: 3,
        imageAlt: "Net of logs",
        imageUrl: null,
      },
      {
        name: "Kindling Bag",
        description: "Dry kindling bag",
        pricePence: 600,
        isActive: true,
        sortOrder: 4,
        imageAlt: "Kindling",
        imageUrl: null,
      },
    ],
  });

  const productRows = await prisma.product.findMany({ orderBy: { sortOrder: "asc" } });

  const customers = [
    { name: "Mike Hilton", email: "verringtonfirewood@gmail.com", phone: "07xxx xxxxxx", postcode: "BA9 8BW" },
    { name: "Verrington Firewood", email: "verringtonfirewood@gmail.com", phone: null, postcode: "BA9 8BW" },
    { name: "Soooooo Young", email: null, phone: null, postcode: "BA9 8BW" },
    { name: "The Bell Inn", email: "orders@bellinn.example", phone: "01935 000000", postcode: "DT9 0AA" },
    { name: "Glamping Co", email: "hello@glamping.example", phone: "01747 000000", postcode: "SP7 9ZZ" },
  ];

  const orderStatuses = ["NEW", "PAID", "OFD", "DELIVERED", "CANCELLED"];
  const paymentStatuses = ["UNPAID", "PENDING", "PAID", "FAILED", "EXPIRED", "CANCELED"];
  const methods = ["MOLLIE", "CASH", "BACS"];

  const now = Date.now();

  for (let i = 1; i <= 36; i++) {
    const c = pick(customers);
    const createdAt = new Date(now - randInt(0, 7 * 24 * 60 * 60 * 1000));

    const status = pick(orderStatuses);
    const checkoutPaymentMethod = pick(methods);
    let paymentStatus = pick(paymentStatuses);

    if (status === "DELIVERED") {
      paymentStatus = pick(["PAID", "UNPAID"]);
    }

    let cancelledAt = null;
    let cancelReason = null;
    if (status === "CANCELLED") {
      cancelledAt = new Date(createdAt.getTime() + randInt(1, 6) * 60 * 60 * 1000);
      paymentStatus = pick(["UNPAID", "FAILED", "EXPIRED", "CANCELED"]);
      cancelReason = pick([
        "Customer cancelled",
        "Out of stock on requested size",
        "Delivery date no longer suitable",
        "Duplicate order",
        null,
      ]);
    }

    const archivedAt =
      createdAt.getTime() < now - 3 * 24 * 60 * 60 * 1000 && Math.random() < 0.25
        ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000)
        : null;

    const molliePaymentId =
      checkoutPaymentMethod === "MOLLIE" ? `tr_seed_${i}_${randInt(1000, 9999)}` : null;
    const mollieCheckoutUrl =
      checkoutPaymentMethod === "MOLLIE" ? `https://checkout.mollie.com/pay/seed_${i}` : null;
    const paidAt =
      paymentStatus === "PAID" ? new Date(createdAt.getTime() + randInt(5, 180) * 60 * 1000) : null;

    const itemCount = pick([1, 1, 2, 2, 3]);
    const items = Array.from({ length: itemCount }).map(() => {
      const p = pick(productRows);
      const qty = p.name === "Net of Logs" || p.name === "Kindling Bag" ? pick([1, 2, 3, 4]) : 1;
      return {
        productId: p.id,
        name: p.name,
        pricePence: p.pricePence,
        quantity: qty,
        lineTotalPence: p.pricePence * qty,
      };
    });

    const subtotalPence = items.reduce((sum, it) => sum + it.lineTotalPence, 0);
    const deliveryFeePence = subtotalPence >= 15000 ? 0 : 500;
    const totalPence = subtotalPence + deliveryFeePence;

    const orderNumber = `VF-ORDER-${pad3(i)}`;

    const order = await prisma.order.create({
      data: {
        createdAt,
        customerName: c.name,
        customerPhone: c.phone,
        customerEmail: c.email,

        postcode: c.postcode,
        town: "Wincanton",
        county: "Somerset",
        addressLine1: pick(["1 High Street", "Rose Cottage", "The Old Mill", "Unit 3, Business Park", null]),
        addressLine2: pick(["Verrington", "Lower Street", null]),
        preferredDay: pick(["Mon", "Tue", "Wed", "Thu", "Fri", null]),
        deliveryNotes: pick(["Leave by garage", "Call on arrival", "Gate code 1234", null]),

        status,
        cancelledAt,
        cancelReason,
        archivedAt,

        subtotalPence,
        deliveryFeePence,
        totalPence,

        orderNumber,

        checkoutPaymentMethod,
        paymentStatus,
        molliePaymentId,
        mollieCheckoutUrl,
        paidAt,

        items: { create: items },
      },
      select: { id: true },
    });

    if (Math.random() < 0.35) {
      await prisma.husbandryLog.create({
        data: {
          orderId: order.id,
          author: "Admin",
          note: pick([
            "Customer asked to move delivery to next week.",
            "Left message — no answer.",
            "Payment pending — keep an eye on it.",
            "Added extra kindling by request.",
            "Spoke to customer: happy to leave by shed.",
          ]),
        },
      });
    }

    if (status === "CANCELLED") {
      await prisma.husbandryLog.create({
        data: {
          orderId: order.id,
          author: "Admin",
          note: `Order cancelled. ${cancelReason ? `Reason: ${cancelReason}` : "No reason recorded."}`,
        },
      });
    }
  }

  console.log("✅ Seed complete: products + 36 orders + items + husbandry logs");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    // your lib/prisma may handle disconnect itself; safe to call if available
    try {
      prisma.$disconnect && prisma.$disconnect();
    } catch {}
  });
