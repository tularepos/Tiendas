import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'order-pdf.js');

function loadModule() {
  const src = fs.readFileSync(SRC, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'order-pdf.js' });
  return ctx.OrderPdf;
}

const payload = () => ({
  items: [
    { productId: '1', name: 'Yerba 500g', quantity: 2, price: 2500 },
    { productId: '2', name: 'Azúcar 1kg', quantity: 1, price: 1200 },
  ],
  total: 6200,
  clientName: 'Cliente Demo',
  clientPhone: '1100000000',
  notes: 'Timbre 2 veces',
  deliveryType: 'envio',
});
const fmt = (n) => '$' + Number(n).toFixed(2);

test('buildModel incluye empresa, pedido, cliente e items', () => {
  const OrderPdf = loadModule();
  const m = OrderPdf.buildModel(payload(), 'Mi Empresa', 'PED-000123');
  assert.equal(m.company, 'Mi Empresa');
  assert.equal(m.orderId, 'PED-000123');
  assert.equal(m.clientName, 'Cliente Demo');
  assert.equal(m.clientPhone, '1100000000');
  assert.equal(m.items.length, 2);
  assert.equal(m.items[0].name, 'Yerba 500g');
});

test('buildModel recalcula el total desde los items', () => {
  const OrderPdf = loadModule();
  const p = payload();
  p.total = 999999; // total mentiroso: el modelo manda
  const m = OrderPdf.buildModel(p, 'Mi Empresa', 'PED-1');
  assert.equal(m.total, 2 * 2500 + 1 * 1200);
});

test('filename usa el id del pedido y cae a pedido-web.pdf sin id', () => {
  const OrderPdf = loadModule();
  assert.equal(OrderPdf.buildModel(payload(), 'T', 'PED-000123').filename, 'pedido-PED-000123.pdf');
  assert.equal(OrderPdf.buildModel(payload(), 'T', '').filename, 'pedido-web.pdf');
  assert.equal(OrderPdf.buildModel(payload(), 'T', 'a/b:c').filename, 'pedido-a-b-c.pdf');
});

test('renderDoc genera un PDF con el comprobante usando jsPDF inyectado', () => {
  const OrderPdf = loadModule();
  const m = OrderPdf.buildModel(payload(), 'Mi Empresa', 'PED-000123');
  const calls = [];
  class FakeDoc {
    constructor() { calls.push(['ctor']); }
    setFontSize(n) { calls.push(['fs', n]); }
    text(t, x, y) { calls.push(['text', String(t)]); }
    addPage() { calls.push(['addPage']); }
    splitTextToSize(t) { return [String(t)]; }
    output(kind) { calls.push(['output', kind]); return 'BLOB'; }
  }
  const out = OrderPdf.renderDoc(m, fmt, FakeDoc);
  assert.equal(out, 'BLOB');
  const texts = calls.filter((c) => c[0] === 'text').map((c) => c[1]).join('\n');
  assert.match(texts, /Mi Empresa/);
  assert.match(texts, /PED-000123/);
  assert.match(texts, /Yerba 500g/);
  assert.match(texts, /\$6200\.00/);
});

test('sharePdf: unsupported sin canShare, shared al compartir, cancelled al abortar', async () => {
  const OrderPdf = loadModule();
  const file = { name: 'pedido.pdf' };
  assert.equal(await OrderPdf.sharePdf(file, 't', {}), 'unsupported');
  assert.equal(await OrderPdf.sharePdf(file, 't', { canShare: () => false }), 'unsupported');
  assert.equal(
    await OrderPdf.sharePdf(file, 't', { canShare: () => true, share: async () => {} }),
    'shared'
  );
  const abort = new Error('cancel');
  abort.name = 'AbortError';
  assert.equal(
    await OrderPdf.sharePdf(file, 't', { canShare: () => true, share: async () => { throw abort; } }),
    'cancelled'
  );
  assert.equal(
    await OrderPdf.sharePdf(file, 't', { canShare: () => true, share: async () => { throw new Error('x'); } }),
    'error'
  );
});
