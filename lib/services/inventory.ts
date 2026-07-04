import {
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
} from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import { isStockTrackedProduct } from "@/lib/catalog/drink-sizes";
import { getProductById, listProducts } from "@/lib/services/products";
import type {
  AppProfile,
  InventoryMovementSummary,
  ProductCardData,
} from "@/types/domain";

export async function listLowStockProducts(): Promise<ProductCardData[]> {
  const products = await listProducts({ includeInactive: true, lowStockOnly: true });
  return products.filter(isStockTrackedProduct);
}

export async function listInventoryMovements(limit = 12): Promise<InventoryMovementSummary[]> {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      product_id: string;
      quantity_delta: number;
      movement_type: InventoryMovementSummary["movementType"];
      created_at: string;
      reason: string | null;
      product_name: string | null;
      product_sku: string | null;
      actor_name: string | null;
    }>(
      `
        select
          m.id,
          m.product_id,
          m.quantity_delta,
          m.movement_type,
          m.created_at,
          m.reason,
          p.name as product_name,
          p.sku as product_sku,
          actor.full_name as actor_name
        from public.inventory_movements m
        join public.products p on p.id = m.product_id
        left join public.profiles actor on actor.id = m.actor_profile_id
        order by m.created_at desc
        limit $1
      `,
      [limit],
    );

    return rows.map((movement) => ({
      id: movement.id,
      productId: movement.product_id,
      productName: movement.product_name ?? "Unknown",
      productSku: movement.product_sku,
      quantityDelta: movement.quantity_delta,
      movementType: movement.movement_type,
      createdAt: movement.created_at,
      reason: movement.reason,
      actorName: movement.movement_type === "sale"
        ? "System"
        : movement.actor_name ?? "System",
    }));
  }

  if (!isSupabaseConfigured()) {
    void limit;
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("inventory_movements")
    .select("id, product_id, actor_profile_id, quantity_delta, movement_type, reason, created_at, products(name, sku)")
    .order("created_at", { ascending: false })
    .limit(limit);

  const movements = (data ?? []) as Array<{
    id: string;
    product_id: string;
    actor_profile_id?: string | null;
    quantity_delta: number;
    movement_type: InventoryMovementSummary["movementType"];
    reason?: string | null;
    created_at: string;
    products?:
      | { name?: string | null; sku?: string | null }
      | Array<{ name?: string | null; sku?: string | null }>
      | null;
  }>;

  const actorIds = Array.from(
    new Set(
      movements
        .map((movement) => movement.actor_profile_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);

    for (const profile of (profiles ?? []) as Array<{
      id: string;
      full_name?: string | null;
      email?: string | null;
    }>) {
      actorMap.set(profile.id, profile.full_name ?? profile.email ?? "System");
    }
  }

  return movements.map((movement) => {
    const productRecord = Array.isArray(movement.products)
      ? movement.products[0]
      : movement.products;

    return {
      id: movement.id,
      productId: movement.product_id,
      productName: productRecord?.name ?? "Unknown",
      productSku: productRecord?.sku ?? null,
      quantityDelta: movement.quantity_delta,
      movementType: movement.movement_type,
      createdAt: movement.created_at,
      reason: movement.reason,
      actorName: movement.movement_type === "sale"
        ? "System"
        : actorMap.get(movement.actor_profile_id ?? "") ?? "System",
    };
  });
}

export async function adjustInventory(profile: AppProfile, input: {
  productId: string;
  quantityDelta: number;
  reason: string;
}) {
  const targetProduct = await getProductById(input.productId);
  if (targetProduct && !isStockTrackedProduct(targetProduct)) {
    throw new Error("Coffee and drink items are prepared on demand and do not need stock updates.");
  }

  if (isPostgresConfigured()) {
    return withDbTransaction(async (client) => {
      const productResult = await client.query<{
        id: string;
        stock_quantity: number;
      }>(
        `
          select id, stock_quantity
          from public.products
          where id = $1
            and deleted_at is null
          limit 1
        `,
        [input.productId],
      );

      const product = productResult.rows[0];
      if (!product) {
        throw new Error("Product not found.");
      }

      const newStockQuantity = product.stock_quantity + input.quantityDelta;
      if (newStockQuantity < 0) {
        throw new Error("Inventory adjustment would make stock negative.");
      }

      await client.query(
        `
          update public.products
          set stock_quantity = $1,
              updated_at = timezone('utc', now())
          where id = $2
        `,
        [newStockQuantity, input.productId],
      );

      await client.query(
        `
          insert into public.inventory_movements (
            product_id,
            actor_profile_id,
            quantity_delta,
            movement_type,
            reason
          )
          values ($1, $2, $3, $4, $5)
        `,
        [
          input.productId,
          profile.id,
          input.quantityDelta,
          input.quantityDelta > 0 ? "restock" : "adjustment",
          input.reason,
        ],
      );

      await client.query(
        `
          insert into public.audit_logs (
            actor_profile_id,
            entity_type,
            entity_id,
            action,
            before_data,
            after_data
          )
          values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        `,
        [
          profile.id,
          "products",
          input.productId,
          "inventory_adjusted",
          JSON.stringify({ stock_quantity: product.stock_quantity }),
          JSON.stringify({
            stock_quantity: newStockQuantity,
            quantity_delta: input.quantityDelta,
            reason: input.reason,
          }),
        ],
      );

      return true;
    });
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Inventory adjustments");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("adjust_inventory_stock", {
    p_actor_profile_id: profile.id,
    p_product_id: input.productId,
    p_quantity_delta: input.quantityDelta,
    p_reason: input.reason,
  });

  if (!error) {
    return true;
  }

  if (!shouldUseDirectInventoryFallback(error.message)) {
    throw new Error(error.message);
  }

  return adjustInventoryDirectly(supabase, profile, input);
}

function shouldUseDirectInventoryFallback(message: string) {
  return message.includes('column "movement_type" is of type inventory_movement_type');
}

async function adjustInventoryDirectly(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profile: AppProfile,
  input: {
    productId: string;
    quantityDelta: number;
    reason: string;
  },
) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, stock_quantity")
    .eq("id", input.productId)
    .is("deleted_at", null)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  const currentStock = product.stock_quantity;
  const newStock = currentStock + input.quantityDelta;

  if (newStock < 0) {
    throw new Error("Inventory adjustment would make stock negative.");
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ stock_quantity: newStock })
    .eq("id", input.productId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const movementType = input.quantityDelta > 0 ? "restock" : "adjustment";
  const { error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      product_id: input.productId,
      actor_profile_id: profile.id,
      movement_type: movementType,
      quantity_delta: input.quantityDelta,
      reason: input.reason,
    });

  if (movementError) {
    await supabase
      .from("products")
      .update({ stock_quantity: currentStock })
      .eq("id", input.productId);

    throw new Error(movementError.message);
  }

  const { error: auditError } = await supabase
    .from("audit_logs")
    .insert({
      actor_profile_id: profile.id,
      entity_type: "products",
      entity_id: input.productId,
      action: "inventory_adjusted",
      before_data: { stock_quantity: currentStock },
      after_data: {
        stock_quantity: newStock,
        reason: input.reason,
        quantity_delta: input.quantityDelta,
      },
    });

  if (auditError) {
    console.error("Inventory audit log insert failed", auditError);
  }

  return true;
}
