const express = require('express');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Ruta principal para probar que el servidor responde
app.get('/', (req, res) => {
    res.send('Servidor activo y listo para realizar búsquedas.');
});

// Función para iniciar el navegador en Render
async function iniciarNavegador() {
    console.log("Iniciando Chromium en la nube...");
    return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });
}

// Escuchar en el puerto de Render
app.listen(PORT, () => {
    console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`);
});
