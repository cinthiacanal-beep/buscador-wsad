const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Servidor activo y funcionando correctamente.');
});

// Función para iniciar el navegador
async function iniciarNavegador() {
    console.log("Iniciando Chromium en la nube...");
    return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

// Mantener el servidor escuchando en el puerto de Render
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
