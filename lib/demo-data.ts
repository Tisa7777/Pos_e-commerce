import type {
  CategorySummary,
  CustomerSummary,
  ProductCardData,
  SupplierSummary,
} from "@/types/domain";

export const DEMO_CATEGORIES: CategorySummary[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Coffee & Tea",
    slug: "coffee-tea",
    description: "Cafe staples for both the storefront and the POS counter.",
    productCount: 2,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Bakery",
    slug: "bakery",
    description: "Fresh baked items that move quickly in person and online.",
    productCount: 1,
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Accessories",
    slug: "accessories",
    description: "Retail goods like tumblers and gift bundles.",
    productCount: 1,
  },
];

const coffeeTea = DEMO_CATEGORIES[0];
const bakery = DEMO_CATEGORIES[1];
const accessories = DEMO_CATEGORIES[2];

export const DEMO_PRODUCTS: ProductCardData[] = [
  {
    id: "66666666-6666-6666-6666-666666666661",
    category: coffeeTea,
    supplierId: "44444444-4444-4444-4444-444444444444",
    name: "Iced Latte",
    slug: "iced-latte",
    description: "A chilled espresso and milk favorite for takeaway or delivery.",
    sku: "CAF-ICL-001",
    barcode: "885100000001",
    price: 4.5,
    cost: 1.6,
    stockQuantity: 48,
    lowStockThreshold: 12,
    isActive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Iced latte",
  },
  {
    id: "66666666-6666-6666-6666-666666666662",
    category: coffeeTea,
    supplierId: "44444444-4444-4444-4444-444444444444",
    name: "Signature Khmer Milk Tea",
    slug: "signature-khmer-milk-tea",
    description: "Sweet milk tea with a local flavor profile and strong repeat sales.",
    sku: "TEA-KMT-002",
    barcode: "885100000002",
    price: 3.75,
    cost: 1.2,
    stockQuantity: 18,
    lowStockThreshold: 10,
    isActive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Milk tea",
  },
  {
    id: "66666666-6666-6666-6666-666666666663",
    category: bakery,
    supplierId: "55555555-5555-5555-5555-555555555555",
    name: "Butter Croissant",
    slug: "butter-croissant",
    description: "A fast-moving POS item that also works well as an add-on in ecommerce.",
    sku: "BAK-CRS-003",
    barcode: "885100000003",
    price: 2.25,
    cost: 0.85,
    stockQuantity: 9,
    lowStockThreshold: 10,
    isActive: true,
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Croissant",
  },
  {
    id: "66666666-6666-6666-6666-666666666664",
    category: accessories,
    supplierId: null,
    name: "Tisa Travel Tumbler",
    slug: "tisa-travel-tumbler",
    description: "Merchandise item for upsells and gift bundles.",
    sku: "ACC-TMB-004",
    barcode: "885100000004",
    price: 14,
    cost: 5.5,
    stockQuantity: 24,
    lowStockThreshold: 6,
    isActive: true,
    imageAlt: "Tisa Travel Tumbler",
  },
];

export const DEMO_SUPPLIERS: SupplierSummary[] = [
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "Mekong Beans Co.",
    contactName: "Sokha Chan",
    email: "beans@mekong.example",
    phone: "+855 12 500 100",
    notes: "Beverage and cafe ingredient supplier.",
    productCount: 2,
    suppliedProducts: DEMO_PRODUCTS.filter(
      (product) => product.supplierId === "44444444-4444-4444-4444-444444444444",
    ).map((product) => ({ id: product.id, name: product.name })),
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "City Bakery Hub",
    contactName: "Dara Lim",
    email: "orders@citybakery.example",
    phone: "+855 77 220 100",
    notes: "Primary bakery partner for fresh pastry drops.",
    productCount: 1,
    suppliedProducts: DEMO_PRODUCTS.filter(
      (product) => product.supplierId === "55555555-5555-5555-5555-555555555555",
    ).map((product) => ({ id: product.id, name: product.name })),
  },
];

export const DEMO_CUSTOMERS: CustomerSummary[] = [
  {
    id: "77777777-7777-7777-7777-777777777771",
    profileId: null,
    fullName: "Walk-in Customer",
    email: null,
    phone: null,
    notes: "Generic POS customer record for quick sales without profile lookup.",
    loyaltyPoints: 0,
    visitCount: 0,
    totalSpent: 0,
    lastSeenAt: null,
    segment: "walk-in",
  },
  {
    id: "77777777-7777-7777-7777-777777777772",
    profileId: "00000000-0000-0000-0000-000000000003",
    fullName: "Rina Sok",
    email: "rina@example.com",
    phone: "+855 88 222 111",
    notes: "Frequent ecommerce buyer who likes gift packaging.",
    loyaltyPoints: 36,
    visitCount: 4,
    totalSpent: 86.5,
    lastSeenAt: new Date().toISOString(),
    segment: "regular",
  },
  {
    id: "77777777-7777-7777-7777-777777777773",
    profileId: null,
    fullName: "Vannak Yim",
    email: "vannak@example.com",
    phone: "+855 96 555 200",
    notes: "Usually shops in-store during lunch rush.",
    loyaltyPoints: 12,
    visitCount: 2,
    totalSpent: 32.25,
    lastSeenAt: new Date().toISOString(),
    segment: "new",
  },
];
