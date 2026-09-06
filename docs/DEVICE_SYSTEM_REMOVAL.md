# Device registry removal

As of migration `20260906150000_remove_device_system.sql`, Velora POS has no device registry, pairing flow, per-device access control, or device-scoped cashier session.

The supported model is:

- every signed-in cashier selects or enters an allowed store;
- every cashier opens their own idempotent session;
- checkout, held carts, manager approval, and session close are scoped by organization, store, user, and session only;
- owner and manager PINs remain available for privileged approvals without switching the active cashier.

The migration deliberately drops the obsolete tables and columns without a broad `CASCADE`, replaces checkout RPC signatures without `p_device_id`, and removes the legacy login/verification overloads. Peripheral integrations such as USB receipt printing and weighing scales remain store/POS features; they are not identity or authorization boundaries.

Before and after deployment, run the catalog contract:

```bash
npm run verify:schema:no-devices:linked
```

It fails if a forbidden table, trigger, function argument/source, `device_id` column, legacy plan limit, or incompatible `set_user_pin` role contract returns.
