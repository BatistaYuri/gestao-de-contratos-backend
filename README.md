# Gestão de Contratos

## Requisitos

- Node.js 24 (versão utilizada no desenvolvimento: v24.15.0)
- Docker
- Git

## Como rodar

```bash
git clone https://github.com/BatistaYuri/gestao-de-contratos-backend.git
cd gestao-de-contratos-backend
npm ci
cp .env.example .env
docker compose up -d
npm run prisma:migrate:deploy
```

No Windows, troque `cp .env.example .env` por:

```powershell
copy .env.example .env
```

Abra três terminais na pasta do projeto e rode um comando em cada:

```bash
npm run dev
```

```bash
npm run dev:scheduler
```

```bash
npm run dev:worker
```

A API estará em `http://localhost:3001`.

Teste em `http://localhost:3001/api/health`.

## Postman

Importe o arquivo `gestao-de-contratos.postman_collection.json` no Postman.

Execute nesta ordem:

1. `Login`
2. `Criar cliente`
3. `Criar contrato`

O token, os IDs e os valores únicos são salvos automaticamente. Os timestamps evitam erros de cliente ou contrato já existente.

Para parar:

```bash
docker compose down
```
