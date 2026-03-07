import { registerPlugin } from "@capacitor/core";

export interface BillingPluginInterface {
  /**
   * Query existing purchases to check if the user has Premium.
   * Returns { isPremium: boolean }
   */
  queryPurchases(): Promise<{ isPremium: boolean }>;

  /**
   * Launch the Google Play billing flow for the "premium_lifetime" product.
   * Returns { purchased: boolean }
   */
  purchasePremium(): Promise<{ purchased: boolean }>;

  /**
   * Restore purchases (same as queryPurchases, but explicit user action).
   * Returns { isPremium: boolean }
   */
  restorePurchases(): Promise<{ isPremium: boolean }>;
}

const BillingPlugin = registerPlugin<BillingPluginInterface>("BillingPlugin");

export default BillingPlugin;
