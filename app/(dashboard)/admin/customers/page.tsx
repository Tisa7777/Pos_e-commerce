import { CustomersCrm } from "@/components/dashboard/customers-crm";
import { listCustomerOrderHistory, listGuestCustomers } from "@/lib/services/customers";
import { listCustomers } from "@/lib/services/products";

export default async function CustomersPage() {
  const [customers, guestResult] = await Promise.all([listCustomers(), listGuestCustomers()]);

  const historyEntries = await Promise.all(
    customers.map(async (customer) => [
      customer.id,
      await listCustomerOrderHistory(customer.id, 6),
    ] as const),
  );

  const orderHistory = {
    ...Object.fromEntries(historyEntries),
    ...guestResult.orderHistory,
  };

  return (
    <CustomersCrm
      initialCustomers={[...customers, ...guestResult.customers]}
      initialOrderHistory={orderHistory}
    />
  );
}
