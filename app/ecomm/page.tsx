export default function EcommPage() {
  return (
    <main className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">E-Commerce</h1>
        <p className="text-sm text-gray-500">Transactions & conversion</p>
      </header>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-700">
          Connecting Wix — in progress
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Completed transactions / web orders (weekly, WoW), sales conversion
          rate (transactions ÷ sessions), and cart abandonment rate. Sourced
          from the Wix Stores/eCommerce APIs plus GA4 sessions.
        </p>
      </div>
    </main>
  );
}
