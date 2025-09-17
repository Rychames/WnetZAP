#!/usr/bin/env node

const fs = require('fs');
const axios = require('axios');
const path = require('path');

// --- Configuração ---
// Define o diretório de logs na raiz do projeto (mesmo nível do server.js)
const LOGS_DIR = path.join(__dirname, 'logs');
// Cria o nome do arquivo de log com a data atual (ex: 2023-10-26.log)
const LOG_FILE = path.join(LOGS_DIR, `${new Date().toISOString().split('T')[0]}.log`);
const API_URL = 'http://localhost:4000/api/zabbix-graph'; //Altere para a porta correta

// Função para registrar logs
const log = (message) => {
    // Garante que o diretório de logs exista
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `${timestamp} - ${message}\n`, 'utf8');
};

// --- Lógica Principal ---
async function main() {
    log('--- Início da execução do script Node.js ---');

    // Argumentos do Zabbix: process.argv[0] é 'node', process.argv[1] é o nome do script
    const phone = process.argv[2];
    const subject = process.argv[3];
    const messageBody = process.argv[4];

    log(`Destinatário (PHONE): ${phone}`);
    log(`Assunto (SUBJECT): ${subject}`);
    log(`Mensagem (MESSAGE_BODY): ${messageBody}`);

    if (!phone || !subject || !messageBody) {
        log('ERRO: Argumentos insuficientes. O script esperava 3 argumentos.');
        log('--- Fim da execução com erro ---');
        return;
    }

    // Extrai o ItemID da mensagem. Espera o formato "ItemID:12345"
    // Ajustado para aceitar "Item ID:" (com espaço) ou "ItemID:" (sem espaço), ignorando maiúsculas/minúsculas.
    const itemIdMatch = messageBody.match(/item\s*id:\s*(\d+)/i);
    if (!itemIdMatch || !itemIdMatch[1]) {
        log(`ERRO: Não foi possível encontrar 'ItemID:...' na mensagem do alerta.`);
        log('--- Fim da execução com erro ---');
        return;
    }
    const itemId = itemIdMatch[1];
    log(`ItemID extraído: ${itemId}`);

    // Monta o payload para a API
    const payload = {
        number: phone,
        itemId: itemId,
        caption: `${subject}\n\n${messageBody}`
    };

    try {
        log(`Enviando requisição para: ${API_URL}`);
        log(`Payload: ${JSON.stringify(payload)}`);

        const response = await axios.post(API_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000 // 15 segundos de timeout
        });

        log(`SUCESSO: API respondeu com status ${response.status}`);
        log(`Resposta da API: ${JSON.stringify(response.data)}`);

    } catch (error) {
        log('ERRO AO FAZER A REQUISIÇÃO AXIOS:');
        if (error.response) {
            // A requisição foi feita e o servidor respondeu com um status de erro
            log(`- Status: ${error.response.status}`);
            log(`- Data: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // A requisição foi feita mas nenhuma resposta foi recebida
            log('- Nenhuma resposta recebida do servidor. Verifique se a API está rodando e acessível.');
            log(`- Detalhes do erro: ${error.message}`);
        } else {
            // Algo aconteceu ao configurar a requisição
            log('- Erro ao configurar a requisição:');
            log(`- Detalhes do erro: ${error.message}`);
        }
    } finally {
        log('--- Fim da execução ---');
    }
}

main();
