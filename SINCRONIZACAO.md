# SIGEN · Base de dados partilhada e sincronização

As duas apps — **SIGEN Exames** (repo `Exames-School`) e **SIGEN Classificações**
(repo `Exames-Classifica-es`) — usam **a mesma base de dados** Supabase (Postgres),
projeto `sigen-exames` (`https://wwfqrwfyucmetxkrkhmm.supabase.co`, região eu-west-1).
Este ficheiro é igual nos dois repositórios.

## O que fica partilhado

| Tabela | Conteúdo | Quem escreve |
|---|---|---|
| `instituicoes` | Agrupamentos e escolas (C03) | as duas apps |
| `utilizadores` | Contas e perfis (C04) | as duas apps |
| `notificacoes` | Avisos e comunicações (C06) | as duas apps + gatilhos |
| `auditoria` | Registo de auditoria (C07) | as duas apps |
| `incidentes_privacidade` | Incidentes RGPD (C07) | as duas apps |
| `alunos` | Alunos (E01) | SIGEN Exames |
| `provas` | Catálogo de provas e sessões (E11) | SIGEN Exames |
| `registos` | Restantes coleções de cada app (JSON), separadas por `app` e `colecao` | cada app as suas |

Vistas de consulta: `v_inscricoes`, `v_presencas`, `v_resultados`.

Perfis: cada app só vê os perfis que conhece. `VIGILANTE` só aparece no Exames;
`CLASSIFICADOR` e `CONFERENTE` só nas Classificações. O EE/aluno maior é
`EE_ALUNO` na base de dados (`EE_ALUNO_MAIOR` no Exames, `ALUNO_EE` nas Classificações).

## O que passa automaticamente de uma app para a outra

Feito por gatilhos na própria base de dados (`supabase/migrations/…_sigen_sync_triggers.sql`),
por isso funciona mesmo que a outra app esteja fechada:

1. **Exames → Classificações — sessão de prova fechada (E19)**
   - aluno *Presente* / *Atraso tolerado* → código anónimo (K03) e lote de provas
     recebido (K01) com a quantidade de provas realizadas;
   - aluno com *Falta* → resultado **"Faltou"** pendente de validação (K09).
2. **Exames → Classificações — catálogo de provas (E11)** → datas de exame no
   calendário das Classificações (C05) para o mesmo ano letivo e fase.
3. **Exames → Classificações — calendário (C05)** → prazos de inscrição e estado.
4. **Classificações → Exames — resultado publicado** → notificação ao
   encarregado de educação / aluno, visível em C06 nas duas apps.

Registos criados pelos gatilhos têm id `sync-…` e a coluna `origem_sync` preenchida.

## Como funciona nas apps

- `src/sync/engine.ts` (igual nas duas apps): ao arrancar carrega tudo da base
  de dados; cada alteração local é enviada (só o que mudou); alterações feitas
  noutro lado chegam em **tempo real** (Supabase Realtime).
- `src/sync/bindings.ts`: conversão entre o formato de cada app e as tabelas.
- `src/sync/config.ts`: URL e chave pública. Pode ser substituído por
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; `VITE_SIGEN_SYNC=off` volta a
  funcionar só com `localStorage`.
- Indicador no cabeçalho: *Sincronizado*, *A guardar…*, *Sem ligação (local)*, *Erro*.
  Sem ligação a app continua a funcionar localmente e volta a tentar a cada 15 s.

## Instalar de raiz noutro projeto Supabase

1. Executar, por ordem, os ficheiros de `supabase/migrations/` no SQL editor.
2. Carregar os dados de exemplo — primeiro o Exames, depois as Classificações:
   ```bash
   npm run db:seed
   ```
   (ou `npm run db:seed-sql > seed.sql` e colar no SQL editor).
3. Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas duas apps.

## ⚠️ Antes de usar com dados reais

As apps ainda usam o login de demonstração (`passwordDemo`), por isso as políticas
RLS dão acesso total ao papel `anon`: **quem tiver a chave pública pode ler e
alterar tudo**. Serve para demonstração com dados de exemplo. Para dados reais de
alunos é preciso migrar o login para Supabase Auth e trocar as políticas
`*_demo_all` por políticas por instituição (`escola_ids` do utilizador).

"Repor dados de exemplo" passa a repor também a base de dados partilhada
(para todos os utilizadores da app).
