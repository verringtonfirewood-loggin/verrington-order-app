import Image from "next/image";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // GBP
  checkoutUrl: string;
};

const PRODUCTS: Product[] = [
  {
    id: "net",
    name: "Net of Logs",
    description: "Perfect for occasional fires. Easy to store and handle.",
    price: 20,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14196058/large-20kg-net-of-logs",
  },
  {
    id: "bulk-bag",
    name: "Bulk Bag of Logs",
    description: "Best value for regular burners. Seasoned hardwood.",
    price: 100,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14196007/back-in-stock-premium-dumpy-bag-of-fully-seasoned-firewood",
  },
  {
    id: "IBC-Crate-Approx-1.2-Cube-of-Logs",
    name: "IBC Crate",
    description: "A full IBC Crate worth of loose-tipped, fully seasoned, beautifully dry, and cut to practical lengths that make lighting your fire effortless..",
    price: 195,
    checkoutUrl: "https://www.verringtonfirewood.co.uk/product/14188502/back-in-stock-ibc-crate-approx-1-2-cube-of-logs",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Verrington Firewood"
            width={180}
            height={60}
            priority
          />

          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--vf-text)" }}>
              Verrington Order App
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--vf-muted)" }}>
              Online ordering for seasoned firewood
            </p>
          </div>
        </div>

        {/* Products */}
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Products</h2>

          <div className="grid gap-6 sm:grid-cols-2">
            {PRODUCTS.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border p-6 flex flex-col justify-between"
                style={{ background: "var(--vf-surface)" }}
              >
                <div>
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--vf-muted)" }}>
                    {product.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xl font-bold">£{product.price}</span>

                  <a
                    href={product.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--vf-primary)",
                      color: "var(--vf-primary-contrast)",
                    }}
                  >
                    Order
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm" style={{ color: "var(--vf-muted)" }}>
            Clicking “Order” opens secure checkout in a new tab.
          </p>
        </section>
      </div>
    </main>
  );
}
