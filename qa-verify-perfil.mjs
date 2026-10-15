// Verificación del modal de Perfil (título = nombre de la empresa sembrada)
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const USER = {
  userName: 'QA Usuario',
  businessName: 'Cafetería QA',
  country: 'MX',
  countryName: 'México',
  currency: 'MXN',
  currencySymbol: '$',
  email: 'qa@test.com',
  acceptedTermsAt: '14/10/2026',
};

const browser = await chromium.launch({ channel: 'msedge' });
const out = [];

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
  await page.addInitScript((user) => {
    const ns = 'abogado-amigo.v1:';
    const account = {
      email: user.email, passwordHash: 'x', salt: 'x', userName: user.userName,
      businessName: user.businessName, country: user.country, countryName: user.countryName,
      currency: user.currency, currencySymbol: user.currencySymbol,
      createdAt: '2026-10-14T00:00:00Z', acceptedTermsAt: user.acceptedTermsAt,
    };
    window.localStorage.setItem(ns + 'activeUser', JSON.stringify(user.email));
    window.localStorage.setItem(ns + 'accounts', JSON.stringify({ [user.email]: account }));
    window.localStorage.setItem(ns + 'u:' + encodeURIComponent(user.email) + ':session', JSON.stringify(user));
  }, USER);

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.click('button[aria-label="Perfil del usuario y tenant MiPyME"]');
  await page.waitForSelector('text=Cafetería QA', { timeout: 10000 });
  await page.waitForTimeout(500);

  const box = await page.evaluate(() => {
    const h = Array.from(document.querySelectorAll('h3')).find((el) =>
      el.textContent?.includes('Cafetería QA')
    );
    const modalEl = h?.closest('div');
    let node = h;
    while (node && !node.className.toString().includes('rounded-2xl')) node = node.parentElement;
    if (!node) return null;
    const r = node.getBoundingClientRect();
    // Botones del pie siempre visibles
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Configurar Modelos')
    );
    const br = btn?.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      dentro: r.bottom <= window.innerHeight && r.top >= 0,
      botonConfigurar: br
        ? { top: Math.round(br.top), bottom: Math.round(br.bottom), visible: br.top < window.innerHeight && br.bottom <= window.innerHeight }
        : null,
    };
  });
  out.push({ viewport: `${viewport.width}x${viewport.height}`, perfil: box });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
