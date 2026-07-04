import { EmployeesManager } from "@/components/dashboard/employees-manager";
import {
  listEmployees,
  isEmployeesTableMissingError,
} from "@/lib/services/employees";
import type { EmployeeSummary } from "@/types/domain";

export default async function EmployeesPage() {
  let setupMissing = false;
  let employees: EmployeeSummary[] = [];

  try {
    employees = await listEmployees();
  } catch (error) {
    if (isEmployeesTableMissingError(error)) {
      setupMissing = true;
    } else {
      throw error;
    }
  }

  return <EmployeesManager initialEmployees={employees} setupMissing={setupMissing} />;
}
