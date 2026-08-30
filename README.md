# Sistema Dra. Brinquinho

Aplicação de gestão da Clínica Dra. Brinquinho.

- Frontend: React, publicado na Vercel em `app.drabrinquinho.com.br`.
- Backend: FastAPI, executado no servidor Oracle em `api.drabrinquinho.com.br`.
- Banco de dados: MongoDB configurado exclusivamente por variáveis de ambiente no servidor.

## Desenvolvimento do frontend

```bash
cd frontend
npm ci
npm start
```

Defina `REACT_APP_BACKEND_URL` com a origem do backend, sem o sufixo `/api`.

## Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload
```

As credenciais, o endereço do MongoDB, a origem CORS e o segredo JWT devem ficar
somente no arquivo `.env` do servidor. Esse arquivo não faz parte do repositório.
