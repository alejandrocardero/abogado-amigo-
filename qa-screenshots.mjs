// QA responsive check: capturas de los modales anclados arriba y de la app
// en móvil (390x844) y escritorio (1280x800). Usa Edge del sistema.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const OUT = '.';

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
    window.localStorage.setItem(
      ns + 'u:' + encodeURIComponent(user.email) + ':session',
      JSON.stringify(user)
    );
  }, USER);
}

const browser = await chromium.launch({ channel: 'msedge' });

async function shoot(name, viewport, work) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // Fuentes de Google bloqueadas en esta red: abortarlas evita que la
  // captura se cuelgue esperando su carga (cae a fuentes del sistema).
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());
  page.on('pageerror', (e) => console.log(`[pageerror] ${name}:`, e.message));
  try {
    await work(page);
  } catch (e) {
    console.log(`[FAIL] ${name}:`, e.message);
  }
  try {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, timeout: 20000 });
    console.log(`[shot] ${name}.png`);
  } catch (e) {
    console.log(`[shot-fail] ${name}:`, e.message);
  }
  await ctx.close();
}

// 1) Pantalla Asistente, móvil y escritorio (sesión sembrada)
await shoot('qa-responsive-asistente-mobile', { width: 390, height: 844 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.waitForTimeout(1500);
});

await shoot('qa-responsive-asistente-desktop', { width: 1280, height: 800 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.waitForTimeout(1500);
});

// 2) Modal de modelos desde el header, móvil — con auto-descubrimiento real
await shoot('qa-responsive-modelos-mobile', { width: 390, height: 844 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.click('button[aria-label="Configuración del modelo de IA"]');
  await page.waitForSelector('text=Configuración de Modelos', { timeout: 10000 });
  // Espera a que termine el auto-descubrimiento + pruebas (modelos cloud tardan)
  await page
    .waitForSelector('text=Disponible', { timeout: 45000 })
    .catch(() => console.log('[warn] modelos: sin badge aún, capturo igual'));
  await page.waitForTimeout(800);
});

// 2b) Modal de modelos, escritorio
await shoot('qa-responsive-modelos-desktop', { width: 1280, height: 800 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.click('button[aria-label="Configuración del modelo de IA"]');
  await page.waitForSelector('text=Configuración de Modelos', { timeout: 10000 });
  await page
    .waitForSelector('text=Disponible', { timeout: 45000 })
    .catch(() => console.log('[warn] modelos: sin badge aún, capturo igual'));
  await page.waitForTimeout(800);
});

// 3) Modal de notificaciones, móvil
await shoot('qa-responsive-notificaciones-mobile', { width: 390, height: 844 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.click('button[aria-label="Estado de sincronización y alertas de gaceta"]');
  await page.waitForSelector('text=Alertas de Gaceta Oficial', { timeout: 10000 });
  await page.waitForTimeout(600);
});

// 4) Modal de perfil, móvil
await shoot('qa-responsive-perfil-mobile', { width: 390, height: 844 }, async (page) => {
  await seedSession(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Abogado Amigo', { timeout: 15000 });
  await page.click('button[aria-label="Perfil del usuario y tenant MiPyME"]');
  await page.waitForSelector('text=Configurar Modelos', { timeout: 10000 });
  await page.waitForTimeout(600);
});

// 5) Harness del modal de modelos (escenario full) en móvil y escritorio
await shoot('qa-responsive-harness-mobile', { width: 390, height: 844 }, async (page) => {
  await page.goto(BASE + '/qa-model-settings.html?s=full', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Configuración de Modelos', { timeout: 15000 });
  await page.waitForTimeout(1200);
});

await shoot('qa-responsive-harness-desktop', { width: 1280, height: 800 }, async (page) => {
  await page.goto(BASE + '/qa-model-settings.html?s=full', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Configuración de Modelos', { timeout: 15000 });
  await page.waitForTimeout(1200);
});

await browser.close();
console.log('QA responsive listo.');
