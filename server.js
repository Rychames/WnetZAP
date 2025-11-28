// BeeZap corrigido para Debian/Node24

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const multer = require('multer');
const moment = require('moment-timezone');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Express
const app = express();
const port = process.env.API_PORT || 4000;
const ZABBIX_GRAPH_DIR = 'zabbix_graphs';

if (!fs.existsSync(ZABBIX_GRAPH_DIR)) fs.mkdirSync(ZABBIX_GRAPH_DIR);

// Puppeteer completo via whatsapp-web.js
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './session' // Persistência garantida no volume Docker
    }),
    puppeteer: {
        headless: true,
        // executablePath: '/usr/bin/google-chrome-stable', // Descomente se o chromium estiver instalado globalmente
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        // Aumenta o timeout para dar mais tempo para a página carregar
        timeout: 120000 // 120 segundos
    }
});

// Eventos
client.on('loading_screen', (percent, message) => console.log('Carregando', percent, message));

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('authenticated', () => console.log('Autenticado'));
client.on('auth_failure', msg => console.error('Falha na autenticação', msg));

client.on('ready', async () => {
    console.log('CLIENTE DO WHATSAPP PRONTO!');

    // Aguarda 3s para evitar erro de contexto destruído
    await new Promise(r => setTimeout(r, 3000));

    app.listen(port, () => {
        console.log(`Servidor da API rodando em http://localhost:${port}`);
        console.log('API pronta para receber requisições.');
    });
});

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Utilitários
const getCurrentTime = () => moment().tz(process.env.TIMEZONE || 'America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');

const getChatId = number => number.includes('@g.us') ? number : (number.length > 15 ? `${number}@g.us` : `${number}@c.us`);

// Rotas (mantidas como no seu código original, sem alterações)

// Envio de mensagem de texto
app.post('/api/message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) return res.status(400).json({ error: 'Parâmetros "number" e "message" são obrigatórios.' });

    try {
        const chatId = getChatId(number);
        await client.sendMessage(chatId, message);
        console.log(getCurrentTime(), `- Mensagem enviada para: ${number}`);
        res.json({ message: 'Mensagem enviada com sucesso' });
    } catch (error) {
        console.error(getCurrentTime(), `- Erro ao enviar mensagem para: ${number}`, error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Upload de arquivo
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, req.body.destination || 'uploads/'),
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

app.post('/api/file', upload.single('file'), async (req, res) => {
    try {
        const { number, caption } = req.body;
        if (!number || !req.file) return res.status(400).json({ error: 'Parâmetros "number" e "file" são obrigatórios.' });

        const filePath = req.file.path;
        const media = MessageMedia.fromFilePath(filePath);
        const chatId = getChatId(number);
        await client.sendMessage(chatId, media, { caption: caption || '' });

        console.log(getCurrentTime(), `- Arquivo enviado para: ${number}`);
        res.json({ message: 'Arquivo enviado com sucesso' });
    } catch (error) {
        console.error(getCurrentTime(), '- Erro ao enviar arquivo:', error);
        res.status(500).send('Erro ao enviar o arquivo');
    }
});

// Gráfico Zabbix
app.post('/api/zabbix-graph', (req, res) => {
    const { number, itemId, caption } = req.body;
    if (!number || !itemId) return res.status(400).json({ error: 'Parâmetros "number" e "itemId" são obrigatórios.' });

    // Aumenta o buffer máximo do exec para acomodar a string base64 da imagem
    const execOptions = { maxBuffer: 1024 * 1024 * 5 }; // 5 MB

    const command = `python3 beebotzap.py "${itemId}"`;
    exec(command, execOptions, async (error, stdout, stderr) => {
        if (error) {
            console.error(getCurrentTime(), `Erro ao executar script Python: ${stderr}`);
            return res.status(500).json({ error: 'Falha ao buscar gráfico do Zabbix.', details: stderr });
        }

        const imageBase64 = stdout.trim();
        console.log(getCurrentTime(), `- Gráfico recebido do Python como Base64 (tamanho: ${imageBase64.length} caracteres)`);

        try {
            // Cria o MessageMedia diretamente da string Base64
            const media = new MessageMedia('image/png', imageBase64, `graph_${itemId}.png`);
            const chatId = getChatId(number);
            await client.sendMessage(chatId, media, { caption: caption || '' });
            console.log(getCurrentTime(), `- Gráfico enviado para: ${number}`);
            res.json({ message: 'Gráfico enviado com sucesso!' });
        } catch (sendError) {
            console.error(getCurrentTime(), `- Erro ao enviar gráfico para ${number}:`, sendError);
            res.status(500).json({ error: 'Falha ao enviar gráfico para o WhatsApp.' });
        }
    });
});

// Rota para listar grupos (funcionalidade do beeid3.js)
app.get('/api/groups', async (req, res) => {
    console.log(getCurrentTime(), '- Recebida requisição para listar grupos.');
    try {
        const chats = await client.getChats();
        const groupChats = chats.filter(chat => chat.isGroup);

        const groupInfo = groupChats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name
        }));

        console.log(getCurrentTime(), `- Total de grupos encontrados: ${groupInfo.length}`);
        res.json(groupInfo);

    } catch (error) {
        console.error(getCurrentTime(), '- Erro ao obter lista de grupos:', error);
        res.status(500).json({ error: 'Erro ao obter a lista de grupos.' });
    }
});


// Inicializa cliente
client.initialize();
