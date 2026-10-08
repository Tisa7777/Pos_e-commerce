"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_DRINK_SIZE,
  getCartLineLabel,
  getDrinkSizePrice,
  isDrinkProduct,
  type DrinkSize,
} from "@/lib/catalog/drink-sizes";
import { calculateDeliveryFee } from "@/lib/checkout/delivery";
import { getCurrentProfile } from "@/lib/auth/guards";
import { isPostgresConfigured, isSupabaseConfigured } from "@/lib/env";
import { dbQuery, withDbTransaction } from "@/lib/db/postgres";
import {
  awardLoyaltyPointsForOrder,
  LoyaltyCouponError,
  markCouponRedeemed,
  validateCouponForCheckout,
} from "@/lib/services/loyalty";
import { getPublicOrderTrackingByNumber } from "@/lib/services/orders";
import { getStoreSettings } from "@/lib/services/currency-settings";
import {
  guestCheckoutSchema,
  guestOrderTrackingSchema,
  type GuestCheckoutInput,
  type GuestOrderTrackingInput,
} from "@/lib/validations/guest-checkout";
import type { ActionState, PublicOrderTracking } from "@/types/domain";

export interface GuestOrderResult {
  orderId: string;
  orderNumber: string;
  guestName: string;
  guestPhone: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  discount?: number;
  couponCode?: string;
  tax: number;
  shippingAmount: number;
  total: number;
  paymentMethod: string;
  deliveryType: string;
  deliveryAddress?: string;
  createdAt: string;
}

interface GuestOrderReceiptOrderRow {
  id: string;
  order_number: string | null;
  created_at: string;
  subtotal_amount: number | string | null;
  discount_amount?: number | string | null;
  tax_amount: number | string | null;
  shipping_amount: number | string | null;
  total_amount: number | string | null;
  notes: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_line_1: string | null;
}

interface GuestOrderReceiptItemRow {
  product_name: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  line_total: number | string | null;
}

interface GuestOrderReceiptPaymentRow {
  method: string | null;
}

interface GuestOrderProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number | string;
  cost?: number | string | null;
  stock_quantity: number;
  categories?: {
    name?: string | null;
    slug?: string | null;
  } | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toMoney(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

// Thrown for known, user-facing validation problems during Postgres checkout so
// the transaction wrapper can roll back and we can surface a friendly message.
class GuestOrderError extends Error {}

function readGuestNoteField(notes: string, label: string) {
  const marker = `${label}: `;
  const start = notes.indexOf(marker);

  if (start === -1) {
    return null;
  }

  const valueStart = start + marker.length;
  const nextSeparator = notes.indexOf(" | ", valueStart);
  const value =
    nextSeparator === -1 ? notes.slice(valueStart) : notes.slice(valueStart, nextSeparator);

  return value.trim() || null;
}

function getGuestOrderItemSize(product: GuestOrderProductRow, size?: DrinkSize | null) {
  return isDrinkProduct({ category: product.categories }) ? size ?? DEFAULT_DRINK_SIZE : null;
}

function isGuestOrderStockTracked(product: GuestOrderProductRow) {
  return !isDrinkProduct({ category: product.categories });
}

function getGuestOrderItemUnitPrice(product: GuestOrderProductRow, size?: DrinkSize | null) {
  return getDrinkSizePrice(Number(product.price), getGuestOrderItemSize(product, size));
}

export async function placeGuestOrderAction(
  input: GuestCheckoutInput,
): Promise<ActionState<GuestOrderResult>> {
  // ── Validate input ──
  const parsed = guestCheckoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the form and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // ── Generate fallback order number ──
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 90000) + 10000);
  const orderNumber = `ORD-${dateStr}-${seq}`;

  // ── Plain PostgreSQL path ──
  if (isPostgresConfigured()) {
    return placeGuestOrderPostgres(data, orderNumber, now);
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Checkout requires a real Supabase backend. Configure Supabase before accepting orders.",
    };
  }

  const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>;

  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (error) {
    console.error(
      "[Guest Order] Service role client error:",
      error instanceof Error ? error.message : error,
    );

    return {
      ok: false,
      message: "Guest checkout is not fully configured. Please contact the shop.",
    };
  }

  const guestNotes = [
    `Guest: ${data.guestName}`,
    `Phone: ${data.guestPhone}`,
    data.guestEmail ? `Email: ${data.guestEmail}` : null,
    `${data.deliveryType === "pickup" ? "Pickup in store" : `Delivery to: ${data.deliveryAddress}`}`,
    data.notes ? `Notes: ${data.notes}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // ── Validate stock & compute subtotal ──
  let computedSubtotal = 0;
  for (const item of data.items) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price, cost, sku, stock_quantity, is_active, deleted_at, categories(name, slug)")
      .eq("id", item.product_id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .single();

    if (productError || !product) {
      return {
        ok: false,
        message: `Product "${item.name}" is no longer available.`,
      };
    }

    const orderProduct = product as GuestOrderProductRow;
    if (isGuestOrderStockTracked(orderProduct) && product.stock_quantity < item.quantity) {
      return {
        ok: false,
        message: `Insufficient stock for "${product.name}". Only ${product.stock_quantity} left.`,
      };
    }

    computedSubtotal += getGuestOrderItemUnitPrice(orderProduct, item.size) * item.quantity;
  }

  const { taxPercent } = await getStoreSettings();
  const computedTax = Math.round(computedSubtotal * (taxPercent / 100) * 100) / 100;
  const computedShipping = calculateDeliveryFee(data.deliveryType, computedSubtotal);
  const computedTotal = Math.round((computedSubtotal + computedTax + computedShipping) * 100) / 100;
  const paymentMethod = data.paymentMethod === "qr" ? "qr" : "cash";
  const currentProfile = await getCurrentProfile();
  let linkedProfileId: string | null = null;
  let linkedCustomerId: string | null = null;

  if (currentProfile?.roles.includes("customer")) {
    linkedProfileId = currentProfile.id;

    const { data: existingCustomer, error: existingCustomerError } = await supabase
      .from("customers")
      .select("id")
      .eq("profile_id", currentProfile.id)
      .maybeSingle();

    if (existingCustomerError) {
      console.error("[Guest Order] Customer lookup error:", existingCustomerError.message);
      return {
        ok: false,
        message: "Unable to link your account to this order. Please try again.",
      };
    }

    if (existingCustomer?.id) {
      linkedCustomerId = existingCustomer.id as string;
    } else {
      const { data: createdCustomer, error: createdCustomerError } = await supabase
        .from("customers")
        .insert({
          profile_id: currentProfile.id,
          full_name: data.guestName || currentProfile.fullName,
          email: data.guestEmail || currentProfile.email,
          phone: data.guestPhone || currentProfile.phone || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (createdCustomerError || !createdCustomer) {
        console.error(
          "[Guest Order] Customer link creation error:",
          createdCustomerError?.message ?? "Missing customer",
        );
        return {
          ok: false,
          message: "Unable to link your account to this order. Please try again.",
        };
      }

      linkedCustomerId = createdCustomer.id as string;
    }
  }

  // ── Create order ──
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      channel: "ecommerce",
      profile_id: linkedProfileId,
      customer_id: linkedCustomerId,
      cashier_profile_id: null,
      status: "pending",
      payment_status: paymentMethod === "cash" ? "pending" : "paid",
      subtotal_amount: computedSubtotal,
      discount_amount: 0,
      tax_amount: computedTax,
      shipping_amount: computedShipping,
      total_amount: computedTotal,
      notes: guestNotes,
      shipping_name: data.deliveryType === "delivery" ? data.guestName : null,
      shipping_phone: data.deliveryType === "delivery" ? data.guestPhone : null,
      shipping_line_1: data.deliveryType === "delivery" ? data.deliveryAddress : null,
      shipping_country: data.deliveryType === "delivery" ? "Cambodia" : null,
    })
    .select("id, order_number")
    .single();

  if (orderError || !orderRow) {
    console.error("[Guest Order] Insert order error:", orderError?.message ?? "Missing order");
    return {
      ok: false,
      message: "Something went wrong placing your order. Please try again.",
    };
  }

  const createdOrderId = orderRow.id as string;
  const stockRollbacks: Array<{ productId: string; stockQuantity: number }> = [];
  const createdItems: GuestOrderResult["items"] = [];

  async function rollbackCreatedOrder() {
    await supabase.from("inventory_movements").delete().eq("order_id", createdOrderId);

    for (const rollback of stockRollbacks.toReversed()) {
      await supabase
        .from("products")
        .update({ stock_quantity: rollback.stockQuantity })
        .eq("id", rollback.productId);
    }

    await supabase.from("orders").delete().eq("id", createdOrderId);
  }

  // ── Insert order items + decrement stock ──
  for (const item of data.items) {
    const { data: product, error: itemProductError } = await supabase
      .from("products")
      .select("id, name, sku, price, cost, stock_quantity, categories(name, slug)")
      .eq("id", item.product_id)
      .single();

    if (itemProductError || !product) {
      console.error(
        "[Guest Order] Reload product error:",
        itemProductError?.message ?? "Missing product",
      );
      await rollbackCreatedOrder();

      return {
        ok: false,
        message: `Product "${item.name}" is no longer available.`,
      };
    }

    const orderProduct = product as GuestOrderProductRow;
    const isStockTracked = isGuestOrderStockTracked(orderProduct);

    if (isStockTracked && product.stock_quantity < item.quantity) {
      await rollbackCreatedOrder();

      return {
        ok: false,
        message: `Insufficient stock for "${product.name}". Only ${product.stock_quantity} left.`,
      };
    }

    const itemSize = getGuestOrderItemSize(orderProduct, item.size);
    const unitPrice = getGuestOrderItemUnitPrice(orderProduct, item.size);
    const lineTotal = unitPrice * item.quantity;

    const { data: orderItem, error: orderItemError } = await supabase
      .from("order_items")
      .insert({
        order_id: createdOrderId,
        product_id: product.id,
        product_name: getCartLineLabel(product.name, itemSize, item.ice, item.sweet),
        sku: product.sku,
        quantity: item.quantity,
        unit_price: unitPrice,
        unit_cost: Number(product.cost),
        discount_amount: 0,
        line_total: lineTotal,
      })
      .select("id")
      .single();

    if (orderItemError || !orderItem) {
      console.error(
        "[Guest Order] Insert item error:",
        orderItemError?.message ?? "Missing order item",
      );
      await rollbackCreatedOrder();

      return {
        ok: false,
        message: "Something went wrong adding items to your order. Please try again.",
      };
    }

    if (isStockTracked) {
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock_quantity: product.stock_quantity - item.quantity })
        .eq("id", product.id);

      if (stockError) {
        console.error("[Guest Order] Stock update error:", stockError.message);
        await rollbackCreatedOrder();

        return {
          ok: false,
          message: "Something went wrong updating product stock. Please try again.",
        };
      }

      stockRollbacks.push({
        productId: product.id,
        stockQuantity: product.stock_quantity,
      });

      const { error: movementError } = await supabase.from("inventory_movements").insert({
        product_id: product.id,
        order_id: createdOrderId,
        order_item_id: orderItem.id,
        movement_type: "sale",
        quantity_delta: -item.quantity,
        reason: "Guest ecommerce order placed",
      });

      if (movementError) {
        console.error("[Guest Order] Inventory movement error:", movementError.message);
        await rollbackCreatedOrder();

        return {
          ok: false,
          message: "Something went wrong recording inventory movement. Please try again.",
        };
      }
    }

    createdItems.push({
      name: getCartLineLabel(product.name, itemSize, item.ice, item.sweet),
      quantity: item.quantity,
      price: unitPrice,
    });
  }

  // ── Insert payment record ──
  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: createdOrderId,
    method: paymentMethod,
    status: paymentMethod === "cash" ? "pending" : "paid",
    amount: computedTotal,
    paid_at: paymentMethod !== "cash" ? new Date().toISOString() : null,
    metadata: {
      channel: "ecommerce",
      guest: !linkedCustomerId,
      profileId: linkedProfileId,
      customerId: linkedCustomerId,
      fulfillmentType: data.deliveryType,
      deliveryFee: computedShipping,
    },
  });

  if (paymentError) {
    console.error("[Guest Order] Insert payment error:", paymentError.message);
    await rollbackCreatedOrder();

    return {
      ok: false,
      message: "Something went wrong recording your payment. Please try again.",
    };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/orders");
  revalidatePath("/pos");
  revalidatePath("/shop");

  return {
    ok: true,
    message: "Order placed successfully!",
    data: {
      orderId: createdOrderId,
      orderNumber: (orderRow.order_number as string) ?? orderNumber,
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      items: createdItems,
      subtotal: computedSubtotal,
      tax: computedTax,
      shippingAmount: computedShipping,
      total: computedTotal,
      paymentMethod: data.paymentMethod,
      deliveryType: data.deliveryType,
      deliveryAddress: data.deliveryAddress || undefined,
      createdAt: now.toISOString(),
    },
  };
}

async function placeGuestOrderPostgres(
  data: GuestCheckoutInput,
  orderNumber: string,
  now: Date,
): Promise<ActionState<GuestOrderResult>> {
  const paymentMethod = data.paymentMethod === "qr" ? "qr" : "cash";
  const guestNotes = [
    `Guest: ${data.guestName}`,
    `Phone: ${data.guestPhone}`,
    data.guestEmail ? `Email: ${data.guestEmail}` : null,
    `${data.deliveryType === "pickup" ? "Pickup in store" : `Delivery to: ${data.deliveryAddress}`}`,
    data.notes ? `Notes: ${data.notes}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const currentProfile = await getCurrentProfile();

  try {
    return await withDbTransaction(async (client) => {
      // ── Link the signed-in customer (so top-buyer reporting works) ──
      let linkedProfileId: string | null = null;
      let linkedCustomerId: string | null = null;

      if (currentProfile?.roles.includes("customer")) {
        linkedProfileId = currentProfile.id;

        const existing = await client.query<{ id: string }>(
          `select id from public.customers where profile_id = $1 limit 1`,
          [currentProfile.id],
        );

        if (existing.rows[0]?.id) {
          linkedCustomerId = existing.rows[0].id;
        } else {
          const created = await client.query<{ id: string }>(
            `
              insert into public.customers (profile_id, full_name, email, phone, is_active)
              values ($1, $2, $3, $4, true)
              returning id
            `,
            [
              currentProfile.id,
              data.guestName || currentProfile.fullName,
              data.guestEmail || currentProfile.email,
              data.guestPhone || currentProfile.phone || null,
            ],
          );
          linkedCustomerId = created.rows[0]?.id ?? null;
        }
      }

      // ── Validate stock, lock rows, and compute totals ──
      const preparedItems: Array<{
        productId: string;
        sku: string | null;
        label: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        stockQuantity: number;
        isStockTracked: boolean;
      }> = [];
      let computedSubtotal = 0;

      for (const item of data.items) {
        const productResult = await client.query<{
          id: string;
          name: string;
          sku: string | null;
          price: number | string;
          stock_quantity: number;
          category_name: string | null;
          category_slug: string | null;
        }>(
          `
            select
              p.id,
              p.name,
              p.sku,
              p.price,
              p.stock_quantity,
              c.name as category_name,
              c.slug as category_slug
            from public.products p
            left join public.categories c on c.id = p.category_id
            where p.id = $1
              and p.is_active = true
              and p.deleted_at is null
            for update of p
          `,
          [item.product_id],
        );

        const product = productResult.rows[0];
        if (!product) {
          throw new GuestOrderError(`Product "${item.name}" is no longer available.`);
        }

        const orderProduct: GuestOrderProductRow = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock_quantity: product.stock_quantity,
          categories: { name: product.category_name, slug: product.category_slug },
        };

        const isStockTracked = isGuestOrderStockTracked(orderProduct);
        if (isStockTracked && product.stock_quantity < item.quantity) {
          throw new GuestOrderError(
            `Insufficient stock for "${product.name}". Only ${product.stock_quantity} left.`,
          );
        }

        const size = getGuestOrderItemSize(orderProduct, item.size);
        const unitPrice = getGuestOrderItemUnitPrice(orderProduct, item.size);
        const lineTotal = unitPrice * item.quantity;
        computedSubtotal += lineTotal;

        preparedItems.push({
          productId: product.id,
          sku: product.sku,
          label: getCartLineLabel(product.name, size, item.ice, item.sweet),
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          stockQuantity: product.stock_quantity,
          isStockTracked,
        });
      }

      const { taxPercent } = await getStoreSettings();
      const computedTax = Math.round(computedSubtotal * (taxPercent / 100) * 100) / 100;
      const computedShipping = calculateDeliveryFee(data.deliveryType, computedSubtotal);

      // ── Apply a loyalty coupon (signed-in customers only) ──
      let discountAmount = 0;
      let appliedCouponId: string | null = null;
      let appliedCouponCode: string | null = null;
      if (data.couponCode && data.couponCode.trim() && linkedCustomerId) {
        const applied = await validateCouponForCheckout(client, {
          code: data.couponCode,
          customerId: linkedCustomerId,
          subtotal: computedSubtotal,
        });
        discountAmount = Math.min(applied.discountAmount, computedSubtotal);
        appliedCouponId = applied.couponId;
        appliedCouponCode = applied.code;
      } else if (data.couponCode && data.couponCode.trim() && !linkedCustomerId) {
        throw new GuestOrderError("Sign in to use a loyalty coupon.");
      }

      const computedTotal =
        Math.round((computedSubtotal - discountAmount + computedTax + computedShipping) * 100) / 100;

      // ── Create order ──
      // `order_number` is intentionally omitted so the column default
      // (public.generate_order_number(), backed by order_number_seq) assigns it.
      // Generating it in JS from Math.random() drew from the same 10000-99999
      // range as the sequence and could collide with the unique index, failing
      // the whole checkout.
      const orderResult = await client.query<{ id: string; order_number: string }>(
        `
          insert into public.orders (
            channel,
            profile_id,
            customer_id,
            cashier_profile_id,
            status,
            payment_status,
            subtotal_amount,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            notes
          )
          values ('ecommerce', $1, $2, null, 'pending', $3, $4, $5, $6, $7, $8, $9)
          returning id, order_number
        `,
        [
          linkedProfileId,
          linkedCustomerId,
          paymentMethod === "cash" ? "pending" : "paid",
          computedSubtotal,
          discountAmount,
          computedTax,
          computedShipping,
          computedTotal,
          guestNotes,
        ],
      );

      const createdOrderId = orderResult.rows[0]?.id;
      if (!createdOrderId) {
        throw new GuestOrderError("Something went wrong placing your order. Please try again.");
      }

      // Mark the coupon used now that the order row exists.
      if (appliedCouponId) {
        await markCouponRedeemed(client, { couponId: appliedCouponId, orderId: createdOrderId });
      }

      const createdItems: GuestOrderResult["items"] = [];

      // ── Insert items, decrement stock, record inventory movements ──
      for (const item of preparedItems) {
        await client.query(
          `
            insert into public.order_items (
              order_id,
              product_id,
              product_name,
              sku,
              quantity,
              unit_price,
              discount_amount,
              line_total
            )
            values ($1, $2, $3, $4, $5, $6, 0, $7)
          `,
          [
            createdOrderId,
            item.productId,
            item.label,
            item.sku,
            item.quantity,
            item.unitPrice,
            item.lineTotal,
          ],
        );

        if (item.isStockTracked) {
          await client.query(
            `
              update public.products
              set stock_quantity = stock_quantity - $1,
                  updated_at = timezone('utc', now())
              where id = $2
            `,
            [item.quantity, item.productId],
          );

          await client.query(
            `
              insert into public.inventory_movements (
                product_id,
                order_id,
                actor_profile_id,
                movement_type,
                quantity_delta,
                reason
              )
              values ($1, $2, $3, 'sale', $4, $5)
            `,
            [
              item.productId,
              createdOrderId,
              linkedProfileId,
              -item.quantity,
              "Ecommerce order placed",
            ],
          );
        }

        createdItems.push({
          name: item.label,
          quantity: item.quantity,
          price: item.unitPrice,
        });
      }

      // ── Award loyalty points to signed-in customers ──
      // NOTE: This must run BEFORE the payment insert below. Inserting a
      // `paid` payment fires the `award_loyalty_points_on_paid_payment`
      // trigger, which also inserts an "earned" loyalty row (guarded by the
      // uniq_loyalty_earned_order constraint with `on conflict do nothing`).
      // Awarding here first makes that trigger insert a no-op, so QR/card
      // orders don't hit a duplicate-key error or double-count points.
      // Cash-on-delivery orders are recorded as `pending`, so they must NOT
      // earn yet: the award_loyalty_points_on_paid_* triggers grant the points
      // when staff mark the order paid. Awarding here would hand out points for
      // an order that may never be paid (and is not reversed on cancel).
      if (linkedCustomerId && paymentMethod !== "cash") {
        await awardLoyaltyPointsForOrder(client, {
          customerId: linkedCustomerId,
          orderId: createdOrderId,
          amountSpent: computedTotal,
        });
      }

      // ── Record payment ──
      await client.query(
        `
          insert into public.payments (
            order_id,
            method,
            status,
            amount,
            paid_at,
            metadata
          )
          values ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          createdOrderId,
          paymentMethod,
          paymentMethod === "cash" ? "pending" : "paid",
          computedTotal,
          paymentMethod === "cash" ? null : new Date().toISOString(),
          JSON.stringify({
            channel: "ecommerce",
            guest: !linkedCustomerId,
            profileId: linkedProfileId,
            customerId: linkedCustomerId,
            fulfillmentType: data.deliveryType,
            deliveryFee: computedShipping,
          }),
        ],
      );

      revalidatePath("/admin/inventory");
      revalidatePath("/admin/reports");
      revalidatePath("/admin/orders");
      revalidatePath("/admin/customers");
      revalidatePath("/pos");
      revalidatePath("/shop");
      revalidatePath("/orders");
      revalidatePath("/account");

      return {
        ok: true,
        message: "Order placed successfully!",
        data: {
          orderId: createdOrderId,
          orderNumber: orderResult.rows[0]?.order_number ?? orderNumber,
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          items: createdItems,
          subtotal: computedSubtotal,
          discount: discountAmount,
          couponCode: appliedCouponCode ?? undefined,
          tax: computedTax,
          shippingAmount: computedShipping,
          total: computedTotal,
          paymentMethod: data.paymentMethod,
          deliveryType: data.deliveryType,
          deliveryAddress: data.deliveryAddress || undefined,
          createdAt: now.toISOString(),
        },
      };
    });
  } catch (error) {
    if (error instanceof GuestOrderError || error instanceof LoyaltyCouponError) {
      return { ok: false, message: error.message };
    }

    console.error(
      "[Guest Order][Postgres] Checkout error:",
      error instanceof Error ? error.message : error,
    );

    return {
      ok: false,
      message: "Something went wrong placing your order. Please try again.",
    };
  }
}

export async function getGuestOrderReceiptAction(
  orderId: string,
): Promise<ActionState<GuestOrderResult>> {
  const normalizedOrderId = orderId.trim();

  if (!UUID_PATTERN.test(normalizedOrderId)) {
    return {
      ok: false,
      message: "Order not found.",
    };
  }

  // ── Plain PostgreSQL path ──
  if (isPostgresConfigured()) {
    const { rows: orderRows } = await dbQuery<GuestOrderReceiptOrderRow>(
      `
        select id, order_number, created_at, subtotal_amount, discount_amount, tax_amount,
               shipping_amount, total_amount, notes,
               null::text as shipping_name,
               null::text as shipping_phone,
               null::text as shipping_line_1
        from public.orders
        where id = $1 and channel = 'ecommerce'
        limit 1
      `,
      [normalizedOrderId],
    );

    const orderRow = orderRows[0];
    if (!orderRow) {
      return { ok: false, message: "Order not found." };
    }

    const { rows: itemRows } = await dbQuery<GuestOrderReceiptItemRow>(
      `
        select product_name, quantity, unit_price, line_total
        from public.order_items
        where order_id = $1
        order by created_at asc
      `,
      [normalizedOrderId],
    );

    const { rows: paymentRows } = await dbQuery<GuestOrderReceiptPaymentRow>(
      `
        select method
        from public.payments
        where order_id = $1
        order by created_at desc
        limit 1
      `,
      [normalizedOrderId],
    );

    const notes = orderRow.notes ?? "";
    const deliveryAddress = readGuestNoteField(notes, "Delivery to");
    const deliveryType = deliveryAddress ? "delivery" : "pickup";

    return {
      ok: true,
      message: "Receipt loaded.",
      data: {
        orderId: orderRow.id,
        orderNumber: orderRow.order_number ?? normalizedOrderId,
        guestName: readGuestNoteField(notes, "Guest") ?? "Guest customer",
        guestPhone: readGuestNoteField(notes, "Phone") ?? "",
        items: itemRows.map((item) => {
          const quantity = toMoney(item.quantity);
          const unitPrice = toMoney(item.unit_price);
          const lineTotal = toMoney(item.line_total);

          return {
            name: item.product_name ?? "Item",
            quantity,
            price: unitPrice > 0 ? unitPrice : lineTotal / Math.max(quantity, 1),
          };
        }),
        subtotal: toMoney(orderRow.subtotal_amount),
        discount: toMoney(orderRow.discount_amount),
        tax: toMoney(orderRow.tax_amount),
        shippingAmount: toMoney(orderRow.shipping_amount),
        total: toMoney(orderRow.total_amount),
        paymentMethod: paymentRows[0]?.method ?? "cash",
        deliveryType,
        deliveryAddress: deliveryAddress ?? undefined,
        createdAt: orderRow.created_at,
      },
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: "Receipts require a real Supabase backend.",
    };
  }

  const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
  let supabase: ReturnType<typeof createSupabaseServiceRoleClient>;

  try {
    supabase = createSupabaseServiceRoleClient();
  } catch (error) {
    console.error(
      "[Guest Receipt] Service role client error:",
      error instanceof Error ? error.message : error,
    );

    return {
      ok: false,
      message: "Receipt lookup is not fully configured. Please contact the shop.",
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, created_at, subtotal_amount, tax_amount, shipping_amount, total_amount, notes, shipping_name, shipping_phone, shipping_line_1",
    )
    .eq("id", normalizedOrderId)
    .eq("channel", "ecommerce")
    .maybeSingle();

  if (orderError) {
    console.error("[Guest Receipt] Load order error:", orderError.message);

    return {
      ok: false,
      message: "Unable to load this receipt. Please try again.",
    };
  }

  if (!order) {
    return {
      ok: false,
      message: "Order not found.",
    };
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, quantity, unit_price, line_total")
    .eq("order_id", normalizedOrderId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("[Guest Receipt] Load items error:", itemsError.message);

    return {
      ok: false,
      message: "Unable to load this receipt. Please try again.",
    };
  }

  const { data: payments, error: paymentError } = await supabase
    .from("payments")
    .select("method")
    .eq("order_id", normalizedOrderId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (paymentError) {
    console.error("[Guest Receipt] Load payment error:", paymentError.message);
  }

  const orderRow = order as GuestOrderReceiptOrderRow;
  const itemRows = (items ?? []) as GuestOrderReceiptItemRow[];
  const paymentRows = (payments ?? []) as GuestOrderReceiptPaymentRow[];
  const notes = orderRow.notes ?? "";
  const deliveryAddress = orderRow.shipping_line_1 ?? readGuestNoteField(notes, "Delivery to");
  const deliveryType = deliveryAddress ? "delivery" : "pickup";

  return {
    ok: true,
    message: "Receipt loaded.",
    data: {
      orderId: orderRow.id,
      orderNumber: orderRow.order_number ?? normalizedOrderId,
      guestName:
        orderRow.shipping_name ?? readGuestNoteField(notes, "Guest") ?? "Guest customer",
      guestPhone: orderRow.shipping_phone ?? readGuestNoteField(notes, "Phone") ?? "",
      items: itemRows.map((item) => {
        const quantity = toMoney(item.quantity);
        const unitPrice = toMoney(item.unit_price);
        const lineTotal = toMoney(item.line_total);

        return {
          name: item.product_name ?? "Item",
          quantity,
          price: unitPrice > 0 ? unitPrice : lineTotal / Math.max(quantity, 1),
        };
      }),
      subtotal: toMoney(orderRow.subtotal_amount),
      tax: toMoney(orderRow.tax_amount),
      shippingAmount: toMoney(orderRow.shipping_amount),
      total: toMoney(orderRow.total_amount),
      paymentMethod: paymentRows[0]?.method ?? "cash",
      deliveryType,
      deliveryAddress: deliveryAddress ?? undefined,
      createdAt: orderRow.created_at,
    },
  };
}

export async function trackGuestOrderAction(
  input: GuestOrderTrackingInput,
): Promise<ActionState<PublicOrderTracking>> {
  const parsed = guestOrderTrackingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a valid order number.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const order = await getPublicOrderTrackingByNumber(parsed.data.orderNumber);

    if (!order) {
      return {
        ok: false,
        message: "We could not find an order with that number.",
      };
    }

    return {
      ok: true,
      message: order.customerMessage,
      data: order,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to track this order.",
    };
  }
}
