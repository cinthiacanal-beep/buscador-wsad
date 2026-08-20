const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const WSAD_USER = 'delegaciondjl';
const WSAD_PASS = '1234';

app.get('/', (req, res) => {
    res.send('Servidor activo y funcionando correctamente.');
});

app.post('/buscar', async (req, res) => {
    const { tipoFormulario, numeroFormulario } = req.body;
    let browser = null;

    try {
        console.log(`Consultando formulario: ${numeroFormulario} (${tipoFormulario})`);

        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // 1. Ir a la página de login
        await page.goto('http://sistemas1.buenosaires.edu.ar/wsad/index.php/login', { waitUntil: 'networkidle2' });

        // Verificar si existen los inputs estándar de SGE o WSAD
        const userInput = await page.$('input[name="signin[username]"], input[name="usuario"], #usuario');
        const passInput = await page.$('input[name="signin[password]"], input[name="clave"], #clave');

        if (userInput && passInput) {
            await userInput.type(WSAD_USER);
            await passInput.type(WSAD_PASS);

            await Promise.all([
                page.keyboard.press('Enter'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
        }

        // 2. Navegar directamente al formulario solicitado
        const modulo = (tipoFormulario === 'titular') ? 'formulario_t_titulares' : 'formulario_t';
        const targetUrl = `http://sistemas1.buenosaires.edu.ar/wsad/frontend.php/${modulo}/${numeroFormulario}/ListGenerar`;

        await page.goto(targetUrl, { waitUntil: 'networkidle2' });

        // 3. Extraer el HTML final
        const htmlContent = await page.content();
        await browser.close();

        return res.json({ exito: true, html: htmlContent });

    } catch (error) {
        if (browser) await browser.close();
        console.error("Error en scraping:", error.message);
        return res.status(500).json({ exito: false, mensaje: 'Error al consultar WSAD: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
