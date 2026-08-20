const express = require('express');
const puppeteer = require('puppeteer'); // Usará Puppeteer estándar para servidores Linux
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const app = express();
const PORT = process.env.PORT || 3000;

const WSAD_USER = 'delegaciondjl';
const WSAD_PASS = '1234';

let page;
let jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

async function iniciarNavegador() {
    console.log("Iniciando Chromium en la nube...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();
}

async function sincronizarCookies() {
    if (!page) return;
    const cookies = await page.cookies();
    for (let cookie of cookies) {
        const cookieStr = `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}`;
        await jar.setCookie(cookieStr, 'http://sistemas1.buenosaires.edu.ar');
    }
}

// Rutina Keep-Alive: Mantiene la sesión viva haciendo un ping cada 3 minutos
setInterval(async () => {
    if (page) {
        try {
            console.log("[Keep-Alive] Renovando sesión...");
            await page.goto('http://sistemas1.buenosaires.edu.ar/wsad/frontend.php/formulario_t_titulares', { waitUntil: 'domcontentloaded' });
            await sincronizarCookies();
        } catch (e) {
            console.error("[Keep-Alive] Error:", e.message);
        }
    }
}, 180000);

// Pantalla para ingresar el CAPTCHA cuando sea necesario revalidar
app.get('/login-captcha', async (req, res) => {
    try {
        await page.goto('http://sistemas1.buenosaires.edu.ar/wsad/index.php/login', { waitUntil: 'domcontentloaded' });
        await page.type('input[name="signin[username]"]', WSAD_USER);
        await page.type('input[name="signin[password]"]', WSAD_PASS);

        // Capturar imagen del captcha
        const captchaElement = await page.$('img[src*="captcha"]') || await page.$('img');
        let captchaBase64 = '';
        if (captchaElement) {
            captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });
        }

        res.send(`
            <div style="font-family: Arial; text-align: center; padding: 40px;">
                <h2>Revalidar Sesión WSAD</h2>
                <p>Ingresa el código CAPTCHA de la imagen:</p>
                <img src="data:image/png;base64,${captchaBase64}" style="border: 1px solid #ccc; margin: 10px;" /><br/>
                <form action="/login-captcha" method="POST">
                    <input type="text" name="captcha" placeholder="Código Captcha" style="padding: 10px; font-size: 16px;" required autocomplete="off"><br/><br/>
                    <button type="submit" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Iniciar Sesión</button>
                </form>
            </div>
        `);
    } catch (e) {
        res.status(500).send("Error generando pantalla de login: " + e.message);
    }
});

app.post('/login-captcha', async (req, res) => {
    const { captcha } = req.body;
    try {
        const captchaInput = await page.$('input[name*="captcha"]') || await page.$('input[type="text"]');
        if (captchaInput) {
            await captchaInput.type(captcha);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                page.click('input[type="submit"]')
            ]);
            await sincronizarCookies();
            return res.send("<h2 style='color:green; text-align:center;'>¡Sesión iniciada con éxito! El servidor está listo.</h2>");
        }
        res.send("No se encontró el campo de captcha.");
    } catch (e) {
        res.status(500).send("Error al enviar captcha: " + e.message);
    }
});

app.get('/buscar', async (req, res) => {
    const { tipo, numero } = req.query;
    console.log(`\n[Petición recibida] Tipo: ${tipo} | Número: ${numero}`);

    try {
        if (tipo === 'titular') {
            await page.goto('http://sistemas1.buenosaires.edu.ar/wsad/frontend.php/formulario_t_titulares', { waitUntil: 'domcontentloaded' });

            const busquedaExitosa = await page.evaluate((num) => {
                const rows = Array.from(document.querySelectorAll('tr'));
                let targetInput = null;
                for (let row of rows) {
                    if (row.textContent.toLowerCase().includes('pof')) {
                        targetInput = row.querySelector('input[type="text"]');
                        if (targetInput) break;
                    }
                }
                if (!targetInput) {
                    targetInput = document.querySelector('input[name*="pof"]') || document.querySelector('input[name*="npof"]');
                }

                if (targetInput) {
                    targetInput.value = num;
                    const btn = Array.from(document.querySelectorAll('input[type="submit"], button, a'))
                        .find(b => (b.value || b.textContent || '').toLowerCase().includes('buscar') || (b.value || b.textContent || '').toLowerCase().includes('filtrar'));
                    if (btn) btn.click();
                    else {
                        const form = targetInput.closest('form');
                        if (form) form.submit();
                    }
                    return true;
                }
                return false;
            }, numero);

            if (busquedaExitosa) {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
            }

            const printUrl = await page.evaluate(() => {
                const enlaces = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('ImprimirFormulario_t_titulares'));
                return enlaces.length > 0 ? enlaces[enlaces.length - 1].href : null;
            });

            if (!printUrl) {
                return res.status(404).send(`<h3 style="color:red; text-align:center;">No se encontró el Titular con POF N° ${numero}</h3>`);
            }

            await sincronizarCookies();
            const response = await client.get(printUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="formulario_titular_${numero}.pdf"`);
            return res.send(Buffer.from(response.data));

        } else {
            await sincronizarCookies();
            const targetUrl = `http://sistemas1.buenosaires.edu.ar/wsad/frontend.php/formulario_t/${numero}/ListGenerar`;
            const response = await client.get(targetUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            res.setHeader('Content-Type', response.headers['content-type'] || 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="formulario_interino_${numero}.pdf"`);
            return res.send(Buffer.from(response.data));
        }

    } catch (error) {
        res.status(500).send("Error obteniendo el formulario: " + error.message);
    }
});

app.listen(PORT, async () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
    await iniciarNavegador();
});