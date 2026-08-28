/**
 * Adapter for shared hours/fulfillment engines. The input is deliberately read
 * only from storefront_* keys so menu settings can never leak into a store.
 */
export function buildStorefrontRuntimeSettings(settings: Record<string, unknown>) {
  return {
    online_menu_ordering_enabled: settings.storefront_ordering_enabled === true,
    online_ordering_paused: settings.storefront_ordering_paused === true,
    online_ordering_hours: settings.storefront_hours,
    online_fulfillment: settings.storefront_fulfillment,
  };
}
