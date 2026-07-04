import { createCustomer, deleteCustomer } from "./lib/services/customers";

async function main() {
  try {
    console.log("Creating customer...");
    const customer = await createCustomer({
      fullName: "Test Customer",
      email: "test@example.com",
    });
    console.log("Created:", customer);
    
    if (!customer) {
        console.log("Failed to create");
        return;
    }

    console.log("Attempting to delete:", customer.id);
    const result = await deleteCustomer(customer.id);
    console.log("Delete result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
