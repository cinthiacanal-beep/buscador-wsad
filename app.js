const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Datos de acceso al sistema WSAD
const WSAD_USER = 'delegaciondjl';
const WSAD_PASS = '1234';

app.get('/', (req, res) => {
    res.send('Servidor activo y funcionando correctamente.');
});

// Ruta POST que procesa la búsqueda desde Google Apps Script
app.post('/buscar', async (req, res) => {
    const { tipoFormulario, numeroFormulario } = req.body;
    let browser = null;

    try {
        console.log(`Iniciando consulta para formulario: ${numeroFormulario} (${tipoFormulario})`);

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // 1. Iniciar sesión en WSAD
        await page.goto('http://sistemas1.buenosaires.edu.ar/wsad/index.php/login', { waitUntil: 'networkidle0' });
        await page.type('input[name="signin[username]"]', WSAD_USER);
        await page.type('input[name="signin[password]"]', WSAD_PASS);
        
        await Promise.all([
            page.click('input[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);

        // 2. Navegar a la URL del formulario
        const modulo = (tipoFormulario === 'titular') ? 'formulario_t_titulares' : 'formulario_t';
        const targetUrl = `http://sistemas1.buenosaires.edu.ar/wsad/frontend.php/${modulo}/${numeroFormulario}/ListGenerar`;

        await page.goto(targetUrl, { waitUntil: 'networkidle0' });

        // 3. Obtener el contenido HTML generado
        const htmlContent = await page.content();
        await browser.close();

        // Enviar respuesta exitosa a Google Apps Script
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
