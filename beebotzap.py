#!/bin/python3
import os
import sys
import requests
import io
import base64

# --- Correção de Codificação para Windows ---
# Força a saída padrão (stdout) a usar a codificação UTF-8 para evitar problemas com caracteres especiais em caminhos de arquivo.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    # --- Validação de Argumentos ---
    if len(sys.argv) < 2:
        print("Erro: Forneça o Item ID do Zabbix como argumento.", file=sys.stderr)
        sys.exit(1)

    item_id = sys.argv[1]

    # --- Declaração de Variáveis ---
    # Mova credenciais e URLs para variáveis de ambiente ou um arquivo de configuração
    zabbix_url = os.getenv('ZABBIX_URL')
    zabbix_user = os.getenv('ZABBIX_USER')
    zabbix_password = os.getenv('ZABBIX_PASSWORD')

    # --- Lógica Principal ---
    login_url = f'{zabbix_url}/index.php'
    login_data = {
        'name': zabbix_user,
        'password': zabbix_password,
        'enter': 'Sign in',
        'autologin': 1,
        'request': ''
    }

    # Usar um objeto de sessão para manter os cookies de login
    with requests.Session() as session:
        try:
            # 1. Faz um GET primeiro para obter cookies iniciais (como CSRF tokens)
            #    Isso simula o comportamento de um navegador ao visitar a página de login.
            session.get(login_url, timeout=10)

            # 2. Agora faz o POST para autenticar, dentro da mesma sessão
            # allow_redirects=True garante que a sessão siga o redirecionamento para o dashboard e capture o cookie.
            login_response = session.post(login_url, data=login_data, timeout=10, allow_redirects=True)
            login_response.raise_for_status()

            if 'zbx_session' not in session.cookies:
                error_message = f"Erro: Falha no login do Zabbix. O cookie 'zbx_session' não foi encontrado após o POST.\nResposta do servidor:\n{login_response.text}"
                print(error_message, file=sys.stderr)
                sys.exit(1)

            # URL do gráfico
            graph_url = f'{zabbix_url}/chart.php?from=now-1h&to=now&itemids[0]={item_id}&type=0&profileIdx=web.charts.filter&width=900'
            graph_response = session.get(graph_url, timeout=15)
            graph_response.raise_for_status()

            # Converte o conteúdo da imagem (bytes) para uma string Base64
            image_base64 = base64.b64encode(graph_response.content).decode('utf-8')

            # Imprime a string Base64 para que o Node.js possa capturá-la
            print(image_base64)

        except requests.exceptions.RequestException as e:
            print(f"Erro de rede ao contatar o Zabbix: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()
    
    
    
