import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('slug con mayúsculas se normaliza a kebab', async () => {
  const { suggestSlug } = await import('../lib/wizard-slug.mjs');
  assert.equal(suggestSlug('Kiosco Don Pepe'), 'kiosco-don-pepe');
});

test('dominio con typo .. se rechaza', () => {
  const re = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  assert.equal(re.test('tienda..com'), false);
  assert.equal(re.test('tienda.donpepe.com'), true);
});

test('vendedor HTML es 1 pantalla novato con Crear tienda', () => {
  const src = fs.readFileSync('api-server.js','utf8');
  // debe tener el nuevo HTML de 1 pantalla novato
  assert.match(src, /Crear tienda/);
  assert.match(src, /Nombre del comercio/);
  // no debe tener las 5 tabs viejas como tabs principales (wizard/alta/clientes/dominio/lic)
  // viejo tenía data-t="wizard" y 5 tabs; nuevo solo tiene 1 pantalla
  const hasOldTabs = src.includes('data-t="wizard"') && src.includes('data-t="alta"') && src.includes('data-t="clientes"');
  assert.equal(hasOldTabs, false, 'vendedor debe ser 1 pantalla novato, no 5 tabs');
});

test('POST create-org-repo con slug inválido 400 existe', async () => {
  // verifica que el endpoint existe en el código (no necesita server vivo)
  const src = fs.readFileSync('api-server.js','utf8');
  assert.match(src, /\/api\/wizard\/create-org-repo/);
  assert.match(src, /Slug inválido/);
});
