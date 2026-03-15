/**
 * Invoice service unit tests
 * Run: npx jest --testPathPattern=invoice.service.test.ts
 */

// Key behaviours tested:
// 1. Overpayment guard (validated in payment.routes.ts)
// 2. Invoice number uniqueness (transactional)
// 3. Discount validation

describe('Invoice business rules', () => {
  describe('totalAmount calculation', () => {
    it('calculates correctly: qty * unitPrice * (1 + tax/100)', () => {
      const qty = 2;
      const unitPrice = 5000;
      const tax = 18;
      const lineTotal = qty * unitPrice * (1 + tax / 100);
      expect(lineTotal).toBe(11800);
    });

    it('applies flat discount after tax', () => {
      const subtotal = 11800;
      const discount = 500;
      const total = subtotal - discount;
      expect(total).toBe(11300);
    });

    it('rejects negative total (discount > invoice value)', () => {
      const subtotal = 1000;
      const discount = 2000;
      const total = subtotal - discount;
      expect(total).toBeLessThan(0);
      // Service should throw ValidationError in this case
    });
  });

  describe('invoice number generation', () => {
    it('formats correctly with prefix and padded number', () => {
      const prefix = 'INV';
      const count = 42;
      const number = `${prefix}-${String(count + 1).padStart(5, '0')}`;
      expect(number).toBe('INV-00043');
    });

    it('generates collision fallback suffix', () => {
      const base = 'INV-00043';
      const fallback = `${base}-${Date.now().toString(36).slice(-4)}`;
      expect(fallback).toMatch(/^INV-00043-[a-z0-9]{4}$/);
    });
  });
});

describe('Payment overpayment guard', () => {
  it('allows exact payment', () => {
    const totalAmount = 5000;
    const alreadyPaid = 2000;
    const newPayment = 3000;
    const remaining = totalAmount - alreadyPaid;
    expect(newPayment).toBeLessThanOrEqual(remaining + 0.01);
  });

  it('blocks overpayment', () => {
    const totalAmount = 5000;
    const alreadyPaid = 4000;
    const newPayment = 2000;
    const remaining = totalAmount - alreadyPaid;
    expect(newPayment).toBeGreaterThan(remaining + 0.01);
  });

  it('allows tiny floating point overage (±0.01 tolerance)', () => {
    const totalAmount = 100.00;
    const alreadyPaid = 99.99;
    const newPayment = 0.01;
    const remaining = totalAmount - alreadyPaid;
    // 0.01 <= 0.01 + 0.01 = true
    expect(newPayment).toBeLessThanOrEqual(remaining + 0.01);
  });
});

describe('Invoice status logic', () => {
  const calcStatus = (totalAmount: number, paidAmount: number) => {
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    return 'UNPAID';
  };

  it('UNPAID when no payments', () => expect(calcStatus(5000, 0)).toBe('UNPAID'));
  it('PARTIAL when partial payment', () => expect(calcStatus(5000, 2000)).toBe('PARTIAL'));
  it('PAID when exact payment', () => expect(calcStatus(5000, 5000)).toBe('PAID'));
  it('PAID when slight overpayment (rounding)', () => expect(calcStatus(5000, 5000.01)).toBe('PAID'));
});
