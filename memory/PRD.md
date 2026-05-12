# Dra. Brinquinho — Sistema de Gestão para Clínica de Body Piercing

## Original Problem Statement
"Monte um aplicativo para uma clínica de body piercing com nome de Dra. Brinquinho. Esse aplicativo deverá resolver problemas de agendamento, cadastro de pacientes, controle de estoque e vendas. Ainda deverá contar com gestão interna, onde consigo colocar formas de pagamento, taxa de cartão, vendas no mês e lucro. Utilize as informações em anexo da tabela de excel com várias abas."

## User Choices
- Autenticação: **sem login** (acesso direto, uso local pessoal)
- Perfil: **apenas admin**
- Ordem dos módulos: Estoque → Agendamento → Pacientes → Gestão
- Lembretes: **marcados como pendentes** internamente (sem envio real ainda; chaves Twilio/Resend a configurar depois)
- Dados da planilha: **cadastro manual** (sistema começa vazio)

## User Personas
- **Dra. Brinquinho (admin único)**: registra vendas, gerencia estoque, agenda procedimentos, acompanha faturamento e lucro.

## Arquitetura
- Backend: FastAPI + Motor (MongoDB) — `/app/backend/server.py`
- Frontend: React 19 + Shadcn UI + Recharts + react-router-dom
- DB: MongoDB (`MONGO_URL`, `DB_NAME`)
- Design: Paleta Terracotta/Peach/Sage, fontes Outfit (heading) + Manrope (body)

## Core Requirements (static)
- Cadastro de produtos (SKU, categoria, valor compra/venda, estoque, mínimo)
- Cadastro de pacientes (responsável, criança, contato)
- Agendamento (data/hora/procedimento/status) com cálculo automático de pós-venda (+45 dias)
- Vendas multi-item com cálculo de lucro = bruto − custo − (bruto × taxa cartão%) e decremento automático de estoque
- Gestão: CRUD de formas de pagamento com taxa, relatório mensal/anual, gráficos
- Dashboard com KPIs do mês, lembretes de pós-venda, alerta de estoque baixo

## What's Been Implemented (2026-02-12)
- ✅ Backend completo (`server.py`): products, patients, appointments, sales, payment-methods, dashboard, reminders, reports/monthly
- ✅ Frontend completo: Dashboard, Estoque, Agendamento (com calendário shadcn), Pacientes, Vendas, Gestão
- ✅ Formas de pagamento padrão criadas no startup: Dinheiro, PIX, Cartão Débito (1.99%), Cartão Crédito (3.99%)
- ✅ Pós-venda automática (45 dias) em agendamentos e vendas
- ✅ Gráficos: linha (vendas diárias), pizza (formas de pagamento), barras (mensal anual)
- ✅ Testes backend: 27/27 passaram (100%)

## Prioritized Backlog (P0 / P1 / P2)
### P0 — Pendente confirmação do usuário
- Envio real de lembretes (Email via Resend ou WhatsApp via Twilio) — aguardando chaves

### P1
- Pré-carregar produtos da planilha Excel (CAIXINHA, ALGODÃO, GAZE, BRINCO, etc.) com seed opcional
- Histórico de agendamentos por paciente (timeline)
- Validação de estoque negativo ao registrar venda
- Exportação CSV/PDF de relatórios mensais

### P2
- Multi-usuário com permissões (recepcionista vs admin)
- Push notifications no navegador
- Backup automático do MongoDB
- Marca d'água/branding personalizado em comprovantes

## Next Tasks
1. Aguardar feedback do usuário após primeiro uso
2. Coletar chaves de integração (Resend/Twilio) quando o usuário desejar ativar lembretes
3. Implementar seed dos itens da planilha caso solicitado
