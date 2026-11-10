import { readActor } from "@/server/auth/session";
import { formatInr } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const orders = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user" || !actor.roles.includes("admin")) return null;
    return store.ordersFor(actor);
  });
  if (!orders) return <p>This module is limited to an admin.</p>;
  return (
    <>
      <h1>Orders</h1>
      {orders.length === 0 && <p className="muted">No orders. Payments are disabled until Razorpay is configured.</p>}
      {orders.map((order) => <p key={order.id}>{order.state} · {formatInr(order.productMinor)} · {order.id}</p>)}
    </>
  );
}
