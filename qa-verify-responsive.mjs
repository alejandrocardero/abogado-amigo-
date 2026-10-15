// Verificación responsive objetiva: mide posición de los modales respecto al
// top del viewport, overflow horizontal y que quepan en pantalla.
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

function seedSession(page) {
  return page.addInitScript((user) => {
    const ns = 'abogado-amigo.v1:';
    const account = {
      email: user.email,
      passwordHash: 'x',
      salt: 'x',
      userName: user.userName,
      businessName: user.businessName,
      country: user.country,
      countryName: user.countryName,
      currency: user.currency,
      currencySymbol: user.currencySymbol,
      createdAt: '2026-10-14T00:00:00Z',
      acceptedTermsAt: user.acceptedTermsAt,
    };
    window.localStorage.setItem(ns + 'activeUser', JSON.stringify(user.email));
    window.localStorage.setItem(ns + 'accounts', JSON.stringify({ [user.email]: account }));
    window.localStorage.setItem(ns + 'u:' + encodeURIComponent(user.email) + ':session', JSON.stringify(user));
  }, USER);
}

const browser = await chromium.launch({ channel: 'msedge' });
const results = [];

async function check(label, viewport, actions) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
  try {
    await seedSession(page);
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Overflow horizontal de la app
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      bodyScrollW: document.body.scrollWidth,
    }));

    // Posición de los 3 botones del header
    const buttons = await page.evaluate(() => {
      const get = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), visible: r.top >= 0 && r.top < window.innerHeight };
      };
      return {
        notif: get('button[aria-label="Estado de sincronización y alertas de gaceta"]'),
        config: get('button[aria-label="Configuración del modelo de IA"]'),
        perfil: get('button[aria-label="Perfil del usuario y tenant MiPyME"]'),
      };
    });

    const modalInfo = [];
    for (const [name, selector, marker] of actions) {
      await page.click(selector);
      await page.waitForSelector(`text=${marker}`, { timeout: 10000 });
      await page.waitForTimeout(500);
      const box = await page.evaluate((markerText) => {
        // El modal es el contenedor del texto del título
        const headings = Array.from(document.querySelectorAll('h3, h2'));
        const h = headings.find((el) => el.textContent?.includes(markerText));
        const modalEl = h?.closest('.fixed, [class*="max-w"]');
        const overlay = modalEl?.parentElement;
        if (!modalEl) return null;
        const r = modalEl.getBoundingClientRect();
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          dentro: r.bottom <= window.innerHeight && r.top >= 0,
          overlayTop: overlay ? Math.round(overlay.getBoundingClientRect().top) : null,
        };
      }, marker);
      modalInfo.push({ modal: name, ...box });
      // cerrar modal
      await page.keyboard.press('Escape');
      const stillOpen = await page.evaluate(() => Boolean(document.querySelector('.fixed.inset-0')));
      if (stillOpen) {
        // Escape no cierra: usar botón Listo/Aceptar/Entendido o backdrop
        await page.mouse.click(10, 300);
      }
      await page.waitForTimeout(400);
    }

    results.push({ label, viewport: `${viewport.width}x${viewport.height}`, overflow, buttons, modalInfo });
  } catch (e) {
    results.push({ label, viewport: `${viewport.width}x${viewport.height}`, error: e.message });
  }
  await ctx.close();
}

const ACTIONS = [
  ['Modelos (⚙️)', 'button[aria-label="Configuración del modelo de IA"]', 'Configuración de Modelos'],
  ['Notificaciones (🔔)', 'button[aria-label="Estado de sincronización y alertas de gaceta"]', 'Alertas de Gaceta Oficial'],
  ['Perfil (👤)', 'button[aria-label="Perfil del usuario y tenant MiPyME"]', 'Sincronización Transfronteriza'],
];

await check('móvil', { width: 390, height: 844 }, ACTIONS);
await check('escritorio', { width: 1280, height: 800 }, ACTIONS);

await browser.close();
console.log(JSON.stringify(results, null, 2));
