export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Enums: {
      discount_type: "percentage" | "fixed_amount";
      inventory_movement_type:
        | "sale"
        | "restock"
        | "adjustment"
        | "return"
        | "initial_stock";
      order_status:
        | "draft"
        | "pending"
        | "paid"
        | "processing"
        | "shipped"
        | "completed"
        | "cancelled"
        | "refunded";
      payment_method:
        | "cash"
        | "card"
        | "qr"
        | "bank_transfer"
        | "cash_on_delivery";
      payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded";
      sale_channel: "pos" | "ecommerce";
      user_role:
        | "admin"
        | "cashier"
        | "customer"
        | "clerk"
        | "manager"
        | (string & {});
    };
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          avatar_path?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      user_roles: {
        Row: {
          id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          parent_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          contact_name?: string | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          supplier_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          sku: string;
          barcode: string | null;
          price: number;
          cost: number;
          stock_quantity: number;
          low_stock_threshold: number;
          is_active: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          supplier_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          sku: string;
          barcode?: string | null;
          price: number;
          cost: number;
          stock_quantity?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          storage_path: string;
          public_url: string | null;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          storage_path: string;
          public_url?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          notes: string | null;
          loyalty_points: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          loyalty_points?: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      addresses: {
        Row: {
          id: string;
          profile_id: string | null;
          customer_id: string | null;
          label: string | null;
          recipient_name: string;
          phone: string | null;
          line_1: string;
          line_2: string | null;
          city: string;
          state: string | null;
          postal_code: string | null;
          country: string;
          is_default_shipping: boolean;
          is_default_billing: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id?: string | null;
          customer_id?: string | null;
          label?: string | null;
          recipient_name: string;
          phone?: string | null;
          line_1: string;
          line_2?: string | null;
          city: string;
          state?: string | null;
          postal_code?: string | null;
          country?: string;
          is_default_shipping?: boolean;
          is_default_billing?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: Database["public"]["Enums"]["discount_type"];
          discount_value: number;
          min_order_amount: number | null;
          starts_at: string | null;
          ends_at: string | null;
          max_redemptions: number | null;
          times_redeemed: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          description?: string | null;
          discount_type: Database["public"]["Enums"]["discount_type"];
          discount_value: number;
          min_order_amount?: number | null;
          starts_at?: string | null;
          ends_at?: string | null;
          max_redemptions?: number | null;
          times_redeemed?: number;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
      };
      carts: {
        Row: {
          id: string;
          profile_id: string;
          channel: Database["public"]["Enums"]["sale_channel"];
          status: "active" | "checked_out" | "abandoned";
          coupon_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          channel?: Database["public"]["Enums"]["sale_channel"];
          status?: "active" | "checked_out" | "abandoned";
          coupon_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["carts"]["Insert"]>;
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cart_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          channel: Database["public"]["Enums"]["sale_channel"];
          profile_id: string | null;
          customer_id: string | null;
          cashier_profile_id: string | null;
          coupon_id: string | null;
          address_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          subtotal_amount: number;
          discount_amount: number;
          tax_amount: number;
          shipping_amount: number;
          total_amount: number;
          notes: string | null;
          shipping_name: string | null;
          shipping_phone: string | null;
          shipping_line_1: string | null;
          shipping_line_2: string | null;
          shipping_city: string | null;
          shipping_state: string | null;
          shipping_postal_code: string | null;
          shipping_country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_number: string;
          channel: Database["public"]["Enums"]["sale_channel"];
          profile_id?: string | null;
          customer_id?: string | null;
          cashier_profile_id?: string | null;
          coupon_id?: string | null;
          address_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          subtotal_amount: number;
          discount_amount?: number;
          tax_amount?: number;
          shipping_amount?: number;
          total_amount: number;
          notes?: string | null;
          shipping_name?: string | null;
          shipping_phone?: string | null;
          shipping_line_1?: string | null;
          shipping_line_2?: string | null;
          shipping_city?: string | null;
          shipping_state?: string | null;
          shipping_postal_code?: string | null;
          shipping_country?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          unit_cost: number;
          discount_amount: number;
          line_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_id: string;
          product_id: string;
          product_name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          unit_cost: number;
          discount_amount?: number;
          line_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          status: Database["public"]["Enums"]["payment_status"];
          amount: number;
          reference_number: string | null;
          paid_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          order_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["payment_status"];
          amount: number;
          reference_number?: string | null;
          paid_at?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      inventory_movements: {
        Row: {
          id: string;
          product_id: string;
          order_id: string | null;
          order_item_id: string | null;
          actor_profile_id: string | null;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity_delta: number;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          order_id?: string | null;
          order_item_id?: string | null;
          actor_profile_id?: string | null;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity_delta: number;
          reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_movements"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_profile_id: string | null;
          entity_type: string;
          entity_id: string | null;
          action: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          actor_profile_id?: string | null;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          before_data?: Json | null;
          after_data?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
  };
}
