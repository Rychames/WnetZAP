# Usa a imagem base do Node.js
FROM node:18-slim

# Instala as dependências do sistema:
# - Dependências do Puppeteer/Chromium
# - Python3 e Pip para executar o script de gráfico do Zabbix
RUN apt-get update && apt-get install -y \
    # Lista de dependências recomendada pela documentação do Puppeteer
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libatspi2.0-0 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    python3 \
    python3-pip \
    python3-requests \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia o package.json e package-lock.json para o contêiner
# Isso otimiza o cache do Docker. As dependências só serão reinstaladas se este arquivo mudar.
COPY package*.json ./

# Instala as dependências do projeto Node.js
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Expõe a porta que a aplicação usa
EXPOSE 4000

# Define o usuário para rodar a aplicação para maior segurança (opcional, mas recomendado)
# RUN useradd -ms /bin/bash nodeuser
# USER nodeuser

# Comando para iniciar a aplicação
CMD ["node", "server.js"]