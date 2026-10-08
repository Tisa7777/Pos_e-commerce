import { slugify } from "@/lib/utils";
import {
  isDemoDataEnabled,
  isPostgresConfigured,
  isSupabaseConfigured,
  requireBackendConfigured,
  requireSupabaseConfigured,
} from "@/lib/env";
import {
  parseCategoryMetadata,
  serializeCategoryMetadata,
} from "@/lib/catalog/category-metadata";
import {
  getCustomerSegment,
  parseCustomerMetadata,
} from "@/lib/crm/customer-metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbQuery } from "@/lib/db/postgres";
import {
  DEMO_CATEGORIES,
  DEMO_CUSTOMERS,
  DEMO_PRODUCTS,
  DEMO_SUPPLIERS,
} from "@/lib/demo-data";
import { saveProductImageLocally } from "@/lib/storage/local-product-images";
import type {
  CategorySummary,
  CustomerSummary,
  ProductCardData,
  SupplierSummary,
} from "@/types/domain";

interface ProductQuery {
  search?: string;
  categorySlug?: string;
  includeInactive?: boolean;
  includeArchived?: boolean;
  lowStockOnly?: boolean;
}

interface RawProductImageRecord {
  public_url?: string | null;
  alt_text?: string | null;
  is_primary?: boolean;
}

interface RawCategoryRecord {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  products?: Array<{ id: string }> | null;
}

interface RawSupplierRecord {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

interface RawCustomerRecord {
  id: string;
  profile_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  loyalty_points?: number;
}

interface RawProductRecord {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  supplier_id?: string | null;
  price: number | string;
  cost: number | string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  categories?: RawCategoryRecord | null;
  product_images?: RawProductImageRecord[] | null;
}

interface PostgresProductRow {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  price: number | string;
  cost: number | string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  supplier_id: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  category_description: string | null;
  image_url: string | null;
  image_alt: string | null;
}

function listDemoProducts(query: ProductQuery = {}) {
  const searchTerm = query.search?.trim().toLowerCase();

  return DEMO_PRODUCTS.filter((product) => {
    if (!query.includeInactive && !product.isActive) {
      return false;
    }

    if (query.categorySlug && product.category?.slug !== query.categorySlug) {
      return false;
    }

    if (query.lowStockOnly && product.stockQuantity > product.lowStockThreshold) {
      return false;
    }

    if (searchTerm) {
      const searchable = [product.name, product.sku, product.barcode ?? ""]
        .join(" ")
        .toLowerCase();

      if (!searchable.includes(searchTerm)) {
        return false;
      }
    }

    return true;
  });
}

function mapProduct(record: RawProductRecord): ProductCardData {
  const primaryImage = Array.isArray(record.product_images)
    ? record.product_images.find((image) => image.is_primary) ?? record.product_images[0]
    : null;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    barcode: record.barcode,
    description: record.description,
    price: Number(record.price),
    cost: Number(record.cost),
    stockQuantity: record.stock_quantity,
    lowStockThreshold: record.low_stock_threshold,
    category: record.categories
      ? {
          id: record.categories.id,
          name: record.categories.name,
          slug: record.categories.slug,
          description: record.categories.description,
        }
      : null,
    supplierId: record.supplier_id ?? null,
    imageUrl: primaryImage?.public_url ?? null,
    imageAlt: primaryImage?.alt_text ?? record.name,
    isActive: record.is_active,
  };
}

function mapPostgresProduct(record: PostgresProductRow): ProductCardData {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    barcode: record.barcode,
    description: record.description,
    price: Number(record.price),
    cost: Number(record.cost),
    stockQuantity: record.stock_quantity,
    lowStockThreshold: record.low_stock_threshold,
    category: record.category_id && record.category_name && record.category_slug
      ? {
          id: record.category_id,
          name: record.category_name,
          slug: record.category_slug,
          description: record.category_description,
        }
      : null,
    supplierId: record.supplier_id,
    imageUrl: record.image_url,
    imageAlt: record.image_alt ?? record.name,
    isActive: record.is_active,
  };
}

export async function listProducts(query: ProductQuery = {}) {
  if (isDemoDataEnabled()) {
    return listDemoProducts(query);
  }

  if (isPostgresConfigured()) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (!query.includeArchived) {
      conditions.push("p.deleted_at is null");
    }

    if (!query.includeInactive) {
      conditions.push("p.is_active = true");
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      const paramIndex = params.length;
      conditions.push(
        `(p.name ilike $${paramIndex} or p.sku ilike $${paramIndex} or coalesce(p.barcode, '') ilike $${paramIndex})`,
      );
    }

    if (query.categorySlug) {
      params.push(query.categorySlug);
      conditions.push(`c.slug = $${params.length}`);
    }

    if (query.lowStockOnly) {
      conditions.push("p.stock_quantity <= p.low_stock_threshold");
    }

    const { rows } = await dbQuery<PostgresProductRow>(
      `
        select
          p.id,
          p.name,
          p.slug,
          p.sku,
          p.barcode,
          p.description,
          p.price,
          p.cost,
          p.stock_quantity,
          p.low_stock_threshold,
          p.is_active,
          p.supplier_id,
          c.id as category_id,
          c.name as category_name,
          c.slug as category_slug,
          c.description as category_description,
          pi.public_url as image_url,
          pi.alt_text as image_alt
        from public.products p
        left join public.categories c
          on c.id = p.category_id
        left join lateral (
          select public_url, alt_text
          from public.product_images
          where product_id = p.id
          order by is_primary desc, sort_order asc, created_at asc
          limit 1
        ) pi on true
        ${conditions.length > 0 ? `where ${conditions.join(" and ")}` : ""}
        order by p.created_at desc
      `,
      params,
    );

    return rows.map(mapPostgresProduct);
  }

  if (!isSupabaseConfigured()) {
    return listDemoProducts(query);
  }

  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("products")
    .select(
      "*, categories(id, name, slug, description), product_images(public_url, alt_text, is_primary, sort_order)",
    )
    .order("created_at", { ascending: false });

  if (!query.includeArchived) {
    request = request.is("deleted_at", null);
  }

  if (!query.includeInactive) {
    request = request.eq("is_active", true);
  }

  if (query.search) {
    request = request.or(
      `name.ilike.%${query.search}%,sku.ilike.%${query.search}%,barcode.ilike.%${query.search}%`,
    );
  }

  const { data } = await request;
  const mapped = ((data ?? []) as RawProductRecord[]).map(mapProduct);

  return mapped.filter((product) => {
    if (query.categorySlug && product.category?.slug !== query.categorySlug) {
      return false;
    }

    if (query.lowStockOnly && product.stockQuantity > product.lowStockThreshold) {
      return false;
    }

    return true;
  });
}

export async function getProductBySlug(slug: string) {
  const products = await listProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getProductById(id: string) {
  if (isDemoDataEnabled()) {
    return DEMO_PRODUCTS.find((product) => product.id === id) ?? null;
  }

  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<PostgresProductRow>(
      `
        select
          p.id,
          p.name,
          p.slug,
          p.sku,
          p.barcode,
          p.description,
          p.price,
          p.cost,
          p.stock_quantity,
          p.low_stock_threshold,
          p.is_active,
          p.supplier_id,
          c.id as category_id,
          c.name as category_name,
          c.slug as category_slug,
          c.description as category_description,
          pi.public_url as image_url,
          pi.alt_text as image_alt
        from public.products p
        left join public.categories c
          on c.id = p.category_id
        left join lateral (
          select public_url, alt_text
          from public.product_images
          where product_id = p.id
          order by is_primary desc, sort_order asc, created_at asc
          limit 1
        ) pi on true
        where p.id = $1
          and p.deleted_at is null
        limit 1
      `,
      [id],
    );

    return rows[0] ? mapPostgresProduct(rows[0]) : null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select(
      "*, categories(id, name, slug, description), product_images(public_url, alt_text, is_primary, sort_order)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  return data ? mapProduct(data as RawProductRecord) : null;
}

export async function listCategories(): Promise<CategorySummary[]> {
  if (isDemoDataEnabled()) {
    return DEMO_CATEGORIES;
  }

  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      product_count: string | number;
    }>(
      `
        select
          c.id,
          c.name,
          c.slug,
          c.description,
          count(p.id) as product_count
        from public.categories c
        left join public.products p
          on p.category_id = c.id
         and p.deleted_at is null
        where c.is_active = true
        group by c.id, c.name, c.slug, c.description
        order by c.name
      `,
    );

    return rows.map((category) => {
      const metadata = parseCategoryMetadata(category.description);

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: metadata.description,
        productCount: Number(category.product_count),
        visualIcon: metadata.visualIcon,
        accentColor: metadata.accentColor,
      };
    });
  }

  if (!isSupabaseConfigured()) {
    return DEMO_CATEGORIES;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, products(id)")
    .eq("is_active", true)
    .order("name");

  return ((data ?? []) as RawCategoryRecord[]).map((category) => {
    const metadata = parseCategoryMetadata(category.description);

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: metadata.description,
      productCount: category.products?.length ?? 0,
      visualIcon: metadata.visualIcon,
      accentColor: metadata.accentColor,
    };
  });
}

export async function listSuppliers(): Promise<SupplierSummary[]> {
  if (isDemoDataEnabled()) {
    return DEMO_SUPPLIERS;
  }

  if (isPostgresConfigured()) {
    const [{ rows: suppliers }, { rows: products }] = await Promise.all([
      dbQuery<RawSupplierRecord & { is_active?: boolean }>(
        `
          select id, name, contact_name, email, phone, notes
          from public.suppliers
          where is_active = true
          order by name
        `,
      ),
      dbQuery<{ id: string; name: string; supplier_id: string | null }>(
        `
          select id, name, supplier_id
          from public.products
          where deleted_at is null
          order by name
        `,
      ),
    ]);

    const productMap = new Map<string, Array<{ id: string; name: string }>>();
    for (const product of products) {
      if (!product.supplier_id) {
        continue;
      }

      const existing = productMap.get(product.supplier_id) ?? [];
      existing.push({ id: product.id, name: product.name });
      productMap.set(product.supplier_id, existing);
    }

    return suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contact_name,
      email: supplier.email,
      phone: supplier.phone,
      notes: supplier.notes,
      suppliedProducts: productMap.get(supplier.id) ?? [],
      productCount: productMap.get(supplier.id)?.length ?? 0,
    }));
  }

  if (!isSupabaseConfigured()) {
    return DEMO_SUPPLIERS;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: suppliers }, { data: productLinks }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, contact_name, email, phone, notes")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("products")
      .select("id, name, supplier_id")
      .is("deleted_at", null)
      .order("name"),
  ]);

  const productMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const product of (productLinks ?? []) as Array<{
    id: string;
    name: string;
    supplier_id?: string | null;
  }>) {
    if (!product.supplier_id) {
      continue;
    }

    const existing = productMap.get(product.supplier_id) ?? [];
    existing.push({ id: product.id, name: product.name });
    productMap.set(product.supplier_id, existing);
  }

  return ((suppliers ?? []) as RawSupplierRecord[]).map((supplier) => {
    const suppliedProducts = productMap.get(supplier.id) ?? [];

    return {
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contact_name,
      email: supplier.email,
      phone: supplier.phone,
      notes: supplier.notes,
      suppliedProducts,
      productCount: suppliedProducts.length,
    };
  });
}

export async function createCategory(input: {
  name: string;
  description?: string;
  visualIcon?: string;
  accentColor?: string;
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
    }>(
      `
        insert into public.categories (name, slug, description, is_active)
        values ($1, $2, $3, true)
        returning id, name, slug, description
      `,
      [input.name, slugify(input.name), serializeCategoryMetadata(input)],
    );

    const created = rows[0];
    const metadata = parseCategoryMetadata(created.description);
    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      description: metadata.description,
      productCount: 0,
      visualIcon: metadata.visualIcon,
      accentColor: metadata.accentColor,
    } satisfies CategorySummary;
  }

  if (!isSupabaseConfigured()) {
    requireSupabaseConfigured("Category creation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: input.name,
      slug: slugify(input.name),
      description: serializeCategoryMetadata(input),
      is_active: true,
    })
    .select("id, name, slug, description")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const metadata = parseCategoryMetadata(data.description);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: metadata.description,
    productCount: 0,
    visualIcon: metadata.visualIcon,
    accentColor: metadata.accentColor,
  } satisfies CategorySummary;
}

export async function updateCategory(input: {
  id: string;
  name: string;
  description?: string;
  visualIcon?: string;
  accentColor?: string;
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
    }>(
      `
        update public.categories
        set name = $2, slug = $3, description = $4
        where id = $1
        returning id, name, slug, description
      `,
      [input.id, input.name, slugify(input.name), serializeCategoryMetadata(input)],
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error("Category not found.");
    }

    const { rows: countRows } = await dbQuery<{ product_count: string | number }>(
      `
        select count(*) as product_count
        from public.products
        where category_id = $1 and deleted_at is null
      `,
      [input.id],
    );

    const metadata = parseCategoryMetadata(updated.description);
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: metadata.description,
      productCount: Number(countRows[0]?.product_count ?? 0),
      visualIcon: metadata.visualIcon,
      accentColor: metadata.accentColor,
    } satisfies CategorySummary;
  }

  if (!isSupabaseConfigured()) {
    requireSupabaseConfigured("Category updates");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .update({
      name: input.name,
      slug: slugify(input.name),
      description: serializeCategoryMetadata(input),
    })
    .eq("id", input.id)
    .select("id, name, slug, description")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const [{ count }, { data: categoryProducts }] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", input.id)
      .is("deleted_at", null),
    supabase
      .from("products")
      .select("id")
      .eq("category_id", input.id)
      .is("deleted_at", null),
  ]);

  const metadata = parseCategoryMetadata(data.description);
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: metadata.description,
    productCount: count ?? categoryProducts?.length ?? 0,
    visualIcon: metadata.visualIcon,
    accentColor: metadata.accentColor,
  } satisfies CategorySummary;
}

export async function deleteCategory(categoryId: string) {
  if (isPostgresConfigured()) {
    const { rows: countRows } = await dbQuery<{ product_count: string | number }>(
      `
        select count(*) as product_count
        from public.products
        where category_id = $1 and deleted_at is null
      `,
      [categoryId],
    );
    const unlinkCount = Number(countRows[0]?.product_count ?? 0);

    await dbQuery(
      `update public.products set category_id = null where category_id = $1`,
      [categoryId],
    );
    await dbQuery(
      `update public.categories set is_active = false where id = $1`,
      [categoryId],
    );

    return { id: categoryId, unlinkedCount: unlinkCount };
  }

  if (!isSupabaseConfigured()) {
    void categoryId;
    requireSupabaseConfigured("Category deletion");
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .is("deleted_at", null);

  const unlinkCount = count ?? 0;

  const { error: unlinkError } = await supabase
    .from("products")
    .update({ category_id: null })
    .eq("category_id", categoryId);

  if (unlinkError) {
    throw new Error(unlinkError.message);
  }

  const { error: deleteError } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", categoryId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return {
    id: categoryId,
    unlinkedCount: unlinkCount,
  };
}

export async function createSupplier(input: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  productIds: string[];
}) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string }>(
      `
        insert into public.suppliers (name, contact_name, email, phone, notes, is_active)
        values ($1, $2, $3, $4, $5, true)
        returning id
      `,
      [
        input.name,
        input.contactName || null,
        input.email || null,
        input.phone || null,
        input.notes || null,
      ],
    );

    const supplierId = rows[0]?.id;
    if (!supplierId) {
      throw new Error("Unable to create supplier.");
    }

    await syncSupplierProductsPostgres(supplierId, input.productIds);
    const suppliers = await listSuppliers();
    return suppliers.find((supplier) => supplier.id === supplierId) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireSupabaseConfigured("Supplier creation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name,
      contact_name: input.contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      notes: input.notes || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await syncSupplierProducts(supabase, data.id, input.productIds);
  const suppliers = await listSuppliers();
  return suppliers.find((supplier) => supplier.id === data.id) ?? null;
}

export async function updateSupplier(input: {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  productIds: string[];
}) {
  if (isPostgresConfigured()) {
    const { rowCount } = await dbQuery(
      `
        update public.suppliers
        set name = $2, contact_name = $3, email = $4, phone = $5, notes = $6
        where id = $1
      `,
      [
        input.id,
        input.name,
        input.contactName || null,
        input.email || null,
        input.phone || null,
        input.notes || null,
      ],
    );

    if (!rowCount) {
      throw new Error("Supplier not found.");
    }

    await syncSupplierProductsPostgres(input.id, input.productIds);
    const suppliers = await listSuppliers();
    return suppliers.find((supplier) => supplier.id === input.id) ?? null;
  }

  if (!isSupabaseConfigured()) {
    requireSupabaseConfigured("Supplier updates");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input.name,
      contact_name: input.contactName || null,
      email: input.email || null,
      phone: input.phone || null,
      notes: input.notes || null,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  await syncSupplierProducts(supabase, input.id, input.productIds);
  const suppliers = await listSuppliers();
  return suppliers.find((supplier) => supplier.id === input.id) ?? null;
}

export async function deleteSupplier(supplierId: string) {
  if (isPostgresConfigured()) {
    const { rows: countRows } = await dbQuery<{ product_count: string | number }>(
      `
        select count(*) as product_count
        from public.products
        where supplier_id = $1 and deleted_at is null
      `,
      [supplierId],
    );
    const unlinkCount = Number(countRows[0]?.product_count ?? 0);

    await dbQuery(
      `update public.products set supplier_id = null where supplier_id = $1`,
      [supplierId],
    );
    await dbQuery(
      `update public.suppliers set is_active = false where id = $1`,
      [supplierId],
    );

    return { id: supplierId, unlinkedCount: unlinkCount };
  }

  if (!isSupabaseConfigured()) {
    void supplierId;
    requireSupabaseConfigured("Supplier deletion");
  }

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .is("deleted_at", null);

  const unlinkCount = count ?? 0;

  const { error: unlinkError } = await supabase
    .from("products")
    .update({ supplier_id: null })
    .eq("supplier_id", supplierId);

  if (unlinkError) {
    throw new Error(unlinkError.message);
  }

  const { error: deleteError } = await supabase
    .from("suppliers")
    .update({ is_active: false })
    .eq("id", supplierId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return {
    id: supplierId,
    unlinkedCount: unlinkCount,
  };
}

async function syncSupplierProductsPostgres(
  supplierId: string,
  selectedProductIds: string[],
) {
  const sanitizedIds = Array.from(new Set(selectedProductIds));

  // Unlink products no longer selected for this supplier.
  if (sanitizedIds.length > 0) {
    await dbQuery(
      `
        update public.products
        set supplier_id = null
        where supplier_id = $1
          and deleted_at is null
          and not (id = any($2::uuid[]))
      `,
      [supplierId, sanitizedIds],
    );

    await dbQuery(
      `
        update public.products
        set supplier_id = $1
        where id = any($2::uuid[])
      `,
      [supplierId, sanitizedIds],
    );
  } else {
    await dbQuery(
      `update public.products set supplier_id = null where supplier_id = $1`,
      [supplierId],
    );
  }
}

async function syncSupplierProducts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  supplierId: string,
  selectedProductIds: string[],
) {
  const sanitizedIds = Array.from(new Set(selectedProductIds));

  const { data: currentlyLinked, error: currentError } = await supabase
    .from("products")
    .select("id")
    .eq("supplier_id", supplierId)
    .is("deleted_at", null);

  if (currentError) {
    throw new Error(currentError.message);
  }

  const currentIds = (currentlyLinked ?? []).map((product) => product.id);
  const idsToUnlink = currentIds.filter((id) => !sanitizedIds.includes(id));
  const idsToAssign = sanitizedIds;

  if (idsToUnlink.length > 0) {
    const { error } = await supabase
      .from("products")
      .update({ supplier_id: null })
      .in("id", idsToUnlink);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (idsToAssign.length > 0) {
    const { error } = await supabase
      .from("products")
      .update({ supplier_id: supplierId })
      .in("id", idsToAssign);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  if (isDemoDataEnabled()) {
    return DEMO_CUSTOMERS;
  }

  if (isPostgresConfigured()) {
    const [{ rows: customers }, { rows: orders }] = await Promise.all([
      dbQuery<RawCustomerRecord>(
        `
          select id, profile_id, full_name, email, phone, notes, loyalty_points
          from public.customers
          where is_active = true
          order by full_name
        `,
      ),
      dbQuery<{
        customer_id: string | null;
        total_amount: number | string;
        created_at: string;
        status: string;
      }>(
        `
          select customer_id, total_amount, created_at, status
          from public.orders
          where customer_id is not null
        `,
      ),
    ]);

    const orderStats = new Map<
      string,
      {
        visitCount: number;
        totalSpent: number;
        lastSeenAt: string | null;
      }
    >();

    for (const order of orders) {
      if (!order.customer_id || ["cancelled", "refunded"].includes(order.status)) {
        continue;
      }

      const existing = orderStats.get(order.customer_id) ?? {
        visitCount: 0,
        totalSpent: 0,
        lastSeenAt: null,
      };

      const createdAtTime = new Date(order.created_at).getTime();
      const lastSeenTime = existing.lastSeenAt ? new Date(existing.lastSeenAt).getTime() : 0;

      orderStats.set(order.customer_id, {
        visitCount: existing.visitCount + 1,
        totalSpent: existing.totalSpent + Number(order.total_amount),
        lastSeenAt: createdAtTime > lastSeenTime ? order.created_at : existing.lastSeenAt,
      });
    }

    return customers.map((customer) => {
      const stats = orderStats.get(customer.id);
      const metadata = parseCustomerMetadata(customer.notes);
      const visitCount = stats?.visitCount ?? 0;

      return {
        id: customer.id,
        profileId: customer.profile_id,
        fullName: customer.full_name,
        email: customer.email,
        phone: customer.phone,
        notes: metadata.notes,
        loyaltyPoints: customer.loyalty_points,
        visitCount,
        totalSpent: stats?.totalSpent ?? 0,
        lastSeenAt: stats?.lastSeenAt ?? null,
        discountPercent: metadata.discountPercent,
        discountExpiresAt: metadata.discountExpiresAt,
        segment: getCustomerSegment({
          fullName: customer.full_name,
          visitCount,
        }),
        hasAccount: Boolean(customer.profile_id),
      };
    });
  }

  if (!isSupabaseConfigured()) {
    return DEMO_CUSTOMERS;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, profile_id, full_name, email, phone, notes, loyalty_points")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("orders")
      .select("id, customer_id, total_amount, created_at, status")
      .not("customer_id", "is", null),
  ]);

  const orderStats = new Map<
    string,
    {
      visitCount: number;
      totalSpent: number;
      lastSeenAt: string | null;
    }
  >();

  for (const order of (orders ?? []) as Array<{
    customer_id?: string | null;
    total_amount: number | string;
    created_at: string;
    status: string;
  }>) {
    if (!order.customer_id || ["cancelled", "refunded"].includes(order.status)) {
      continue;
    }

    const existing = orderStats.get(order.customer_id) ?? {
      visitCount: 0,
      totalSpent: 0,
      lastSeenAt: null,
    };

    const createdAtTime = new Date(order.created_at).getTime();
    const lastSeenTime = existing.lastSeenAt
      ? new Date(existing.lastSeenAt).getTime()
      : 0;

    orderStats.set(order.customer_id, {
      visitCount: existing.visitCount + 1,
      totalSpent: existing.totalSpent + Number(order.total_amount),
      lastSeenAt:
        createdAtTime > lastSeenTime ? order.created_at : existing.lastSeenAt,
    });
  }

  return ((customers ?? []) as RawCustomerRecord[]).map((customer) => {
    const stats = orderStats.get(customer.id);
    const metadata = parseCustomerMetadata(customer.notes);
    const visitCount = stats?.visitCount ?? 0;

    return {
      id: customer.id,
      profileId: customer.profile_id,
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      notes: metadata.notes,
      loyaltyPoints: customer.loyalty_points,
      visitCount,
      totalSpent: stats?.totalSpent ?? 0,
      lastSeenAt: stats?.lastSeenAt ?? null,
      discountPercent: metadata.discountPercent,
      discountExpiresAt: metadata.discountExpiresAt,
      segment: getCustomerSegment({
        fullName: customer.full_name,
        visitCount,
      }),
      hasAccount: Boolean(customer.profile_id),
    };
  });
}

type ProductMutationInput = {
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  categoryId?: string;
  supplierId?: string;
  price: number;
  cost: number;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
};

export async function createProduct(input: ProductMutationInput) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string; slug: string }>(
      `
        insert into public.products (
          name,
          slug,
          description,
          sku,
          barcode,
          category_id,
          supplier_id,
          price,
          cost,
          stock_quantity,
          low_stock_threshold,
          is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning id, slug
      `,
      [
        input.name,
        slugify(input.name),
        input.description || null,
        input.sku,
        input.barcode || null,
        input.categoryId || null,
        input.supplierId || null,
        input.price,
        input.cost,
        input.stockQuantity,
        input.lowStockThreshold,
        input.isActive,
      ],
    );

    return rows[0];
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Product creation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      slug: slugify(input.name),
      description: input.description || null,
      sku: input.sku,
      barcode: input.barcode || null,
      category_id: input.categoryId || null,
      supplier_id: input.supplierId || null,
      price: input.price,
      cost: input.cost,
      stock_quantity: input.stockQuantity,
      low_stock_threshold: input.lowStockThreshold,
      is_active: input.isActive,
    })
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateProduct(input: ProductMutationInput & { id: string }) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string; slug: string }>(
      `
        update public.products
        set
          name = $2,
          slug = $3,
          description = $4,
          sku = $5,
          barcode = $6,
          category_id = $7,
          supplier_id = $8,
          price = $9,
          cost = $10,
          stock_quantity = $11,
          low_stock_threshold = $12,
          is_active = $13
        where id = $1
          and deleted_at is null
        returning id, slug
      `,
      [
        input.id,
        input.name,
        slugify(input.name),
        input.description || null,
        input.sku,
        input.barcode || null,
        input.categoryId || null,
        input.supplierId || null,
        input.price,
        input.cost,
        input.stockQuantity,
        input.lowStockThreshold,
        input.isActive,
      ],
    );

    if (!rows[0]) {
      throw new Error("Product not found.");
    }

    return rows[0];
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Product updates");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      slug: slugify(input.name),
      description: input.description || null,
      sku: input.sku,
      barcode: input.barcode || null,
      category_id: input.categoryId || null,
      supplier_id: input.supplierId || null,
      price: input.price,
      cost: input.cost,
      stock_quantity: input.stockQuantity,
      low_stock_threshold: input.lowStockThreshold,
      is_active: input.isActive,
    })
    .eq("id", input.id)
    .is("deleted_at", null)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function setProductActive(productId: string, isActive: boolean) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string }>(
      `
        update public.products
        set
          is_active = $2,
          deleted_at = null
        where id = $1
        returning id
      `,
      [productId, isActive],
    );

    if (!rows[0]) {
      throw new Error("Product not found.");
    }

    return rows[0];
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Product status updates");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      is_active: isActive,
      deleted_at: null,
    })
    .eq("id", productId)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteProduct(productId: string) {
  if (isPostgresConfigured()) {
    const { rows } = await dbQuery<{ id: string; slug: string }>(
      `
        update public.products
        set
          is_active = false,
          deleted_at = timezone('utc', now())
        where id = $1
          and deleted_at is null
        returning id, slug
      `,
      [productId],
    );

    if (!rows[0]) {
      throw new Error("Product not found.");
    }

    return rows[0];
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Product deletion");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .is("deleted_at", null)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function uploadProductImage(productId: string, file: File) {
  if (isPostgresConfigured()) {
    const storedImage = await saveProductImageLocally(productId, file);

    await dbQuery(
      `
        update public.product_images
        set is_primary = false
        where product_id = $1
      `,
      [productId],
    );

    await dbQuery(
      `
        insert into public.product_images (
          product_id,
          storage_path,
          public_url,
          alt_text,
          is_primary
        )
        values ($1, $2, $3, $4, $5)
      `,
      [productId, storedImage.storagePath, storedImage.publicUrl, file.name, true],
    );

    return {
      publicUrl: storedImage.publicUrl,
    };
  }

  if (!isSupabaseConfigured()) {
    requireBackendConfigured("Product image uploads");
  }

  const supabase = await createSupabaseServerClient();
  const extension = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${productId}/${crypto.randomUUID()}.${extension}`;

  await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId);

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(storagePath);

  await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    public_url: publicUrlData.publicUrl,
    alt_text: file.name,
    is_primary: true,
  });

  return publicUrlData;
}
