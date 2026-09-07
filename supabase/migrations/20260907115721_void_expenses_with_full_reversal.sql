-- Preserve cancelled expenses as accounting documents instead of deleting them.
-- The application posts any required GL/treasury reversals before setting this state.

ALTER TYPE expense_status ADD VALUE IF NOT EXISTS 'voided';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_voided_at
  ON public.expenses(voided_at DESC)
  WHERE status = 'voided';
